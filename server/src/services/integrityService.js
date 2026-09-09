// server/src/services/integrityService.js — Couche « écriture » de l'Intégrité (ITG) du matériel :
// test de panne, panne systématique, édition MJ. PLAN_USURE&INTEGRITE.md §4 (L2, volet service).
//
// Autorité unique des mutations `char_inventory.integrity_current / integrity_max /
// malfunction_severity` : REST comme socket passent par ce service, jamais `char_inventory` en
// direct (`.claude/rules/core.md`). L'INTERPRÉTATION (palier, math des pertes) vit dans
// `shared/integrityRules.js` (pur) ; le JET dans `polarisTestService.js` (`resolvePolarisTest`,
// moteur de Test unique — invariant #2). Ce fichier n'émet aucun événement : il renvoie le détail,
// l'appelant émet `INVENTORY_UPDATED` / `DICE_RESULT` (D7, patron `inventoryService` / `char-sheet.js`).
//
// Concurrence : chaque fonction verrouille la ligne (`.forUpdate()`) et la relit À FRAIS dans la
// transaction avant de calculer — jamais depuis une ligne passée en paramètre (qui pourrait être
// périmée : édition MJ concurrente, panne combat pendant une édition). Patron pessimiste établi du
// projet (`tradeService`, `worldEffectService`). [Le PLAN M5 évoquait un jeton `updated_at` optimiste
// « patron Blessures » — ce patron n'existe pas dans le code ; le verrou pessimiste `.forUpdate()`
// atteint le même but et EST le patron du projet.]
//
// `trxOpt` optionnel en dernier paramètre (convention `mutationService` / `advantageService`) :
// fourni → on reste dans la transaction de l'appelant ; absent → on ouvre la nôtre. La résolution
// de combat n'étant pas une transaction unique (PLAN §7.1.c), le test de panne d'arme appelle sans
// `trxOpt` — la panne est une conséquence postérieure, elle n'annule rien.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { resolvePolarisTest } from '../lib/polarisTestService.js'
import { parseDice } from '../lib/diceParser.js'
import { applyTemporaryLoss, interpretPanneOutcome, QUALITY_TABLE, DEFAULT_QUALITY } from '../../../shared/integrityRules.js'

const SEVERITY_VALUES = ['simple', 'critical']

// computeAcquisitionIntegrity({ quality, isBlackMarket }) — ITG d'un objet `has_integrity` acheté
// chez un Marchand (PLAN §5.1). Marché noir → NEUF (courante = ITG max de la qualité). Marché
// légal → OCCASION (jet de la formule d'occasion de la qualité, plafonné au max). `quality` NULL
// → `bonne_qualite` (MANUEL §3.1). Renvoie `{ integrity_current, integrity_max }`. Pas d'I/O DB
// (seulement `parseDice`) — appelable HORS transaction, une fois par exemplaire physique.
export async function computeAcquisitionIntegrity({ quality, isBlackMarket } = {}) {
  const q = QUALITY_TABLE[quality] ?? QUALITY_TABLE[DEFAULT_QUALITY]
  const integrity_max = q.itgMax
  const integrity_current = isBlackMarket
    ? integrity_max
    : Math.min(integrity_max, (await parseDice(q.occasionFormula)).total)
  return { integrity_current, integrity_max }
}

// Verrouille la ligne d'inventaire (`.forUpdate()` — uniquement `char_inventory`, jamais le
// catalogue partagé `ref_equipment`) et lui adjoint `has_integrity` lu à part sur `ref_equipment`
// (le flag vit sur le MODÈLE, pas l'instance — même lecture séparée que `inventoryService`).
async function lockInventoryRow(trx, invId, characterId) {
  const where = characterId ? { id: invId, character_id: characterId } : { id: invId }
  const row = await trx('char_inventory').where(where).forUpdate().first()
  if (!row) return null
  const ref = row.equipment_id
    ? await trx('ref_equipment').where({ id: row.equipment_id }).first('has_integrity', 'quality')
    : null
  return { ...row, has_integrity: Boolean(ref?.has_integrity), quality: ref?.quality ?? null }
}

function snapshot(row) {
  return {
    current: row.integrity_current,
    max: row.integrity_max,
    malfunction_severity: row.malfunction_severity,
  }
}

// Une perte d'ITG en panne : applique `applyTemporaryLoss`, force `malfunction_severity = 'critical'`
// si la courante tombe à 0 (RAW : « 0 et − → hors d'usage, malfunction_severity = critical »),
// sinon la gravité fournie. Écrit la ligne. Renvoie le snapshot après + le détail de la perte.
async function applyPanneLoss(trx, row, { loss, severity }) {
  const { newCurrent, newMax, definitiveLoss, tiersCrossed } = applyTemporaryLoss(
    row.integrity_current, row.integrity_max, loss,
  )
  const malfunction = newCurrent === 0 ? 'critical' : severity
  await trx('char_inventory').where({ id: row.id }).update({
    integrity_current: newCurrent,
    integrity_max: newMax,
    malfunction_severity: malfunction,
    updated_at: trx.fn.now(),
  })
  return {
    after: { current: newCurrent, max: newMax, malfunction_severity: malfunction },
    definitiveLoss,
    tiersCrossed,
  }
}

// runPanneTest(invId, { reason }, trxOpt) — Test de panne RAW : 1D20 sous l'ITG courante, sans
// aucun modificateur (`resolvePolarisTest(integrity_current)`, MANUEL §4.1). Réussite → rien.
// Échec simple → −1 ITG, `malfunction_severity = 'simple'`. Catastrophe → −1D6 ITG,
// `malfunction_severity = 'critical'`. N'annule jamais l'action en cours (la panne est postérieure).
// `reason` : trace libre reportée dans le retour (`'combat_low_itg'`, `'intensive'`, catastrophe #8…).
export async function runPanneTest(invId, { reason, characterId } = {}, trxOpt) {
  const run = async (trx) => {
    const row = await lockInventoryRow(trx, invId, characterId)
    if (!row) throw new AppError(404, 'Objet d\'inventaire introuvable')
    if (!row.has_integrity || row.integrity_current == null) {
      return { panne: 'skipped', reason: reason ?? null, skippedBecause: 'no_integrity' }
    }

    const before = snapshot(row)
    const outcome = await resolvePolarisTest(row.integrity_current)
    const panne = interpretPanneOutcome(outcome) // 'ok' | 'simple' | 'critical'

    const common = {
      panne,
      reason: reason ?? null,
      roll: outcome.roll,
      threshold: row.integrity_current,
      catastropheRisk: outcome.catastropheRisk,
      criticalFailReroll: outcome.criticalFailReroll ?? null,
      before,
    }

    if (panne === 'ok') {
      return { ...common, loss: 0, after: before, definitiveLoss: 0, tiersCrossed: 0 }
    }

    const loss = panne === 'critical' ? (await parseDice('1D6')).total : 1
    const applied = await applyPanneLoss(trx, row, { loss, severity: panne })
    return { ...common, loss, ...applied }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// applyPanneSystematic(invId, { reason }, trxOpt) — panne AUTOMATIQUE sans jet : ITG ≤ 5 + usage
// intensif ou non conventionnel (MANUEL §4.2). −1 ITG, `malfunction_severity = 'simple'`. Le caller
// (L7, bouton « Usage intensif ») garantit `integrity_current <= 5` ; au-dessus il route vers
// `runPanneTest`.
export async function applyPanneSystematic(invId, { reason, characterId } = {}, trxOpt) {
  const run = async (trx) => {
    const row = await lockInventoryRow(trx, invId, characterId)
    if (!row) throw new AppError(404, 'Objet d\'inventaire introuvable')
    if (!row.has_integrity || row.integrity_current == null) {
      return { panne: 'skipped', reason: reason ?? null, skippedBecause: 'no_integrity' }
    }
    const before = snapshot(row)
    const applied = await applyPanneLoss(trx, row, { loss: 1, severity: 'simple' })
    return { panne: 'simple', systematic: true, reason: reason ?? null, loss: 1, before, ...applied }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// adjustIntegrity(invId, changes, trxOpt) — édition manuelle par le MJ ou le propriétaire (D3 —
// l'autorisation est faite par la route, pas ici, comme `inventoryService.updateItem`). `changes` :
//   { current?, max?, malfunction? }  — chaque champ absent = inchangé.
//   `malfunction`: null (Opérationnel) | 'simple' | 'critical'.
// Valide la cohérence (0 ≤ current ≤ max, 1 ≤ max ≤ 25, les deux ITG ensemble ou aucune) avec un
// message clair plutôt qu'une violation de CHECK brute.
export async function adjustIntegrity(invId, changes = {}, trxOpt) {
  const run = async (trx) => {
    const row = await lockInventoryRow(trx, invId)
    if (!row) throw new AppError(404, 'Objet d\'inventaire introuvable')
    if (!row.has_integrity) {
      throw new AppError(400, 'Cet objet ne suit pas l\'Intégrité (le flag se règle sur le catalogue)')
    }

    const before = snapshot(row)
    const updates = {}
    const nextCurrent = 'current' in changes ? changes.current : row.integrity_current
    const nextMax = 'max' in changes ? changes.max : row.integrity_max

    if ('current' in changes || 'max' in changes) {
      const bothNull = nextCurrent == null && nextMax == null
      const bothSet = Number.isInteger(nextCurrent) && Number.isInteger(nextMax)
      if (!bothNull && !bothSet) {
        throw new AppError(400, 'ITG courante et ITG max vont ensemble : les deux ou aucune')
      }
      if (bothSet) {
        if (nextMax < 1 || nextMax > 25) throw new AppError(400, 'ITG max hors bornes (1 à 25)')
        if (nextCurrent < 0) throw new AppError(400, 'ITG courante négative')
        if (nextCurrent > nextMax) throw new AppError(400, 'ITG courante au-dessus de l\'ITG max')
      }
      updates.integrity_current = nextCurrent
      updates.integrity_max = nextMax
    }

    if ('malfunction' in changes) {
      const m = changes.malfunction
      if (m != null && !SEVERITY_VALUES.includes(m)) {
        throw new AppError(400, `malfunction_severity invalide : ${m}`)
      }
      updates.malfunction_severity = m ?? null
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'Aucun champ d\'Intégrité à modifier')
    }

    updates.updated_at = trx.fn.now()
    await trx('char_inventory').where({ id: invId }).update(updates)
    const fresh = await trx('char_inventory').where({ id: invId }).first()
    return { before, after: snapshot(fresh) }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// rollOccasionIntegrity(invId, trxOpt) — bouton « Lancer ITG occasion » (MJ, PLAN §5.3). Réétablit
// l'ITG de l'objet comme un achat d'OCCASION : ITG max = celle de sa qualité, courante = jet de la
// formule d'occasion (plafonné). Écrase les valeurs en place. Émet `INVENTORY_UPDATED` (la route).
export async function rollOccasionIntegrity(characterId, invId, trxOpt) {
  const run = async (trx) => {
    const row = await lockInventoryRow(trx, invId, characterId)
    if (!row) throw new AppError(404, 'Objet d\'inventaire introuvable')
    if (!row.has_integrity) {
      throw new AppError(400, 'Cet objet ne suit pas l\'Intégrité (le flag se règle sur le catalogue)')
    }
    const before = snapshot(row)
    const { integrity_current, integrity_max } = await computeAcquisitionIntegrity({
      quality: row.quality, isBlackMarket: false,
    })
    await trx('char_inventory').where({ id: invId }).update({
      integrity_current, integrity_max, updated_at: trx.fn.now(),
    })
    return { before, after: { current: integrity_current, max: integrity_max, malfunction_severity: row.malfunction_severity } }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}
