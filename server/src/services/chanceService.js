// server/src/services/chanceService.js — Autorité unique des mutations `char_sheet.chc`
// (docs/PLANS/PLAN_CHANCE.md L2/L3). `char_sheet.chc` est à la fois le score de Chance et la
// réserve dépensable (docs/MANUELS/MANUEL_CHANCE.md §1) — aucune colonne séparée.
//
// Patron : `db` importé une fois ici (jamais passé en paramètre), `trxOpt` optionnel en dernier
// argument (convention `integrityService` / `advantageService` / `mutationService`) — fourni →
// on reste dans la transaction de l'appelant, absent → on ouvre la nôtre. Verrou pessimiste
// `.forUpdate()` sur la ligne `char_sheet`, relue à frais dans la transaction (jamais depuis une
// valeur passée en paramètre, qui pourrait être périmée) — même patron établi que
// `integrityService.lockInventoryRow`.
//
// Ce service ignore la raison métier du montant dépensé/regagné (`n`) — chaque appelant applique
// ses propres règles RAW (forçage AOE, réduction de gravité, régénération Catastrophe...), ce
// fichier ne fait que garder la contrainte générique et écrire.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

// RAW (REGLE_CHANCE.md) : plancher absolu de la réserve de Chance — un personnage descendu à 3
// ne peut plus en dépenser. `spendChancePoints` REJETTE toute opération qui franchirait ce
// plancher (choix joueur refusable) ; `cancelChanceGrant` (correction MJ, jamais initiée par le
// joueur) CLAMPE dessus plutôt que de rejeter — même plancher, sémantique différente selon qui
// déclenche l'écriture (décision Saar 2026-09-11).
const CHC_FLOOR = 3
const CHC_CEIL = 20 // contrainte applicative déjà en place (PUT /chc, char-sheet.js:497)

async function lockSheetRow(trx, sheetId) {
  const row = await trx('char_sheet').where({ id: sheetId }).forUpdate().first()
  if (!row) throw new AppError(404, 'Fiche personnage introuvable')
  return row
}

// spendChancePoints(sheetId, n, { reason }, trxOpt) → { chc, reason }
// Garde RAW : chc - n >= 3, rejette sinon (AppError 400, aucune écriture). `n` ∈ {1, 2} selon
// l'appelant (Événement favorable, réduction de gravité...) — pas de connaissance ici du palier
// ou de l'effet obtenu, seulement la dépense de la réserve.
export async function spendChancePoints(sheetId, n, { reason } = {}, trxOpt) {
  const run = async (trx) => {
    const row = await lockSheetRow(trx, sheetId)
    const next = row.chc - n
    if (next < CHC_FLOOR) {
      throw new AppError(400, `Chance insuffisante (minimum ${CHC_FLOOR} pour dépenser)`)
    }
    const [updated] = await trx('char_sheet')
      .where({ id: sheetId })
      .update({ chc: next, updated_at: trx.fn.now() })
      .returning('chc')
    return { chc: updated.chc, reason: reason ?? null }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// grantChancePoint(sheetId, n = 1, trxOpt) → { chc }
// Inverse de spendChancePoints — plafond min(chc + n, 20). Générique : aucune connaissance de la
// raison métier ni du plafond RAW 15 propre à la régénération Catastrophe (celui-ci vit dans
// chanceService.handleCatastropheRegen, L3b — pas ici, car les futures régénérations "bonne
// idée"/"accomplissement" n'ont que ce plafond 20, pas 15, PLAN_CHANCE.md §5).
export async function grantChancePoint(sheetId, n = 1, trxOpt) {
  const run = async (trx) => {
    const row = await lockSheetRow(trx, sheetId)
    const next = Math.min(row.chc + n, CHC_CEIL)
    const [updated] = await trx('char_sheet')
      .where({ id: sheetId })
      .update({ chc: next, updated_at: trx.fn.now() })
      .returning('chc')
    return { chc: updated.chc }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// cancelChanceGrant(sheetId, n, trxOpt) → { chc }
// Revert d'un grantChancePoint automatique, initié par le MJ (jamais par le joueur). Clampe sur
// le même plancher RAW que spendChancePoints, mais ne rejette jamais : une correction MJ doit
// toujours pouvoir s'appliquer (décision Saar 2026-09-11).
export async function cancelChanceGrant(sheetId, n, trxOpt) {
  const run = async (trx) => {
    const row = await lockSheetRow(trx, sheetId)
    const next = Math.max(row.chc - n, CHC_FLOOR)
    const [updated] = await trx('char_sheet')
      .where({ id: sheetId })
      .update({ chc: next, updated_at: trx.fn.now() })
      .returning('chc')
    return { chc: updated.chc }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// RAW (REGLE_CHANCE.md) : Catastrophe sur un Test aléatoire → +1 Chance, SAUF si chc >= 15 (pas de
// regain). Plafond dédié à cette seule source de régénération, pas celui de grantChancePoint (20) —
// les futures régénérations "bonne idée"/"accomplissement" n'auront que le plafond 20, pas 15
// (PLAN_CHANCE.md §5).
const CHC_CATASTROPHE_REGEN_CEIL = 15

// handleCatastropheRegen(sheetId, { testLabel }, trxOpt) → { chc, granted, testLabel }
// Vérifie et applique le plafond 15 SOUS LE MÊME VERROU que le grant (atomique) — une lecture
// chc<15 non verrouillée pourrait sinon autoriser un regain après qu'un événement concurrent ait
// déjà porté chc à 15+ entre la vérification et l'écriture. Le choix joueur (gagner le point vs
// relancer) a déjà eu lieu avant cet appel (L3e) : cette fonction ne fait que le grant, jamais la
// relance — point d'entrée unique pour tous les sites, logique de garde écrite une seule fois.
export async function handleCatastropheRegen(sheetId, { testLabel } = {}, trxOpt) {
  const run = async (trx) => {
    const row = await lockSheetRow(trx, sheetId)
    if (row.chc >= CHC_CATASTROPHE_REGEN_CEIL) {
      return { chc: row.chc, granted: false, testLabel: testLabel ?? null }
    }
    const { chc } = await grantChancePoint(sheetId, 1, trx)
    return { chc, granted: true, testLabel: testLabel ?? null }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}
