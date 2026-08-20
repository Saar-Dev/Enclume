/**
 * exoAvarieService.js — Compteur d'Avaries + perte d'Intégrité pour les exo-armures
 *
 * PLAN_EXOARMURE.md §11 (Lot 4 — Pipeline de dégâts). Patron transactionnel repris de
 * woundService.js/woundUtils.js (resolveWoundInsertion) — même principe RAW ("le compteur d'Avaries
 * fonctionne comme le compteur de Blessures des personnages", REGLEARMURE.md:330-331), adapté à des
 * colonnes entières `exo_sheet.avaries_*` plutôt qu'à des lignes `character_wounds` : une exo-armure a
 * UN SEUL compteur d'Avaries global, jamais un compteur par localisation (la localisation ne joue que
 * pour le jet d'incident, Lot 5a, hors périmètre ici).
 */

import {
  EXO_AVARIE_TABLE, EXO_AVARIE_SEVERITY_ORDER, EXO_AVARIE_COLUMN_BY_SEVERITY as COLUMN_BY_SEVERITY,
} from '../../../shared/exoConstants.js'
import { WS } from '../../../shared/events.js'
import { resolveExoContext } from './combatantContextService.js'
import { calcExoDegatsNets } from './charStats.js'

// REGLEARMURE.md:317-407 (seuils p.326) — mêmes seuils numériques que la sévérité de Blessures
// humaine (LdB p.114, damageService.js:_severityForDamage) mais VOLONTAIREMENT pas réutilisée : deux
// tables RAW indépendantes qui partagent ces seuils par coïncidence, jamais couplées — si l'une des
// deux change un jour sans l'autre, un partage de fonction casserait silencieusement (PLAN_EXOARMURE.md
// §11.3, analyse à charge 2026-08-19).
export function severityForExoDamage(net) {
  if      (net >= 30) return 'destruction'
  else if (net >= 25) return 'catastrophique'
  else if (net >= 20) return 'critique'
  else if (net >= 15) return 'grave'
  else if (net >= 10) return 'moyenne'
  else if (net >=  5) return 'legere'
  return null
}

function nextAvarieSeverity(severity) {
  const idx = EXO_AVARIE_SEVERITY_ORDER.indexOf(severity)
  return idx >= 0 && idx < EXO_AVARIE_SEVERITY_ORDER.length - 1 ? EXO_AVARIE_SEVERITY_ORDER[idx + 1] : null
}

// Cascade récursive de promotion — miroir de resolveWoundInsertion (woundUtils.js:36-65) mais pure
// (aucun accès DB, contrairement à sa contrepartie humaine qui insère/supprime des lignes) : retourne
// les colonnes à écrire, jamais n'écrit elle-même. `exoSheet` n'a besoin que des colonnes avaries_*
// lues (mutation locale `{ ...exoSheet, [column]: 0 }` pour la récursion, jamais l'objet DB original).
//
// Ligne déjà à maxCount-1 : cette Avarie COMPLÉTERAIT la ligne → promotion au lieu d'être posée
// (REGLEARMURE.md:335-337 "quand une ligne est complète alors qu'on doit noter une Avarie de cette
// gravité, on coche une case dans le niveau supérieur et on efface la ligne complète" — même
// interprétation que resolveWoundInsertion:47, "currentCount >= maxCount - 1" : le nombre de cases
// réellement stocké ne atteint jamais maxCount en pratique, la dernière déclenche toujours la
// promotion à sa place).
//
// Perte d'ITG Structure sur la transition 0→1 uniquement (REGLEARMURE.md:344-353 : "cette perte
// intervient bien dès qu'un de ces seuils est atteint, et non à chaque Avarie reçue dans l'un d'eux"),
// vérifiée à la ligne où la cascade ATTERRIT réellement — direct ou après promotion, traité pareil.
// `destruction` fait exception : aucune colonne/compteur persistant pour ce palier (image RAW, "pas de
// case"), perte d'ITG inconditionnelle à chaque coup de cette sévérité (REGLEARMURE.md:351-353, "si
// elle subit ensuite une Destruction, elle perdra un nouveau point").
function resolveAvarieIncrement(exoSheet, severity) {
  if (severity === 'destruction') {
    return {
      updates: {}, finalSeverity: 'destruction', destroyed: true,
      itgLoss: EXO_AVARIE_TABLE.destruction.itgLossStructure,
    }
  }

  const table  = EXO_AVARIE_TABLE[severity]
  const column = COLUMN_BY_SEVERITY[severity]
  const currentCount = exoSheet[column] ?? 0
  const next = nextAvarieSeverity(severity)

  if (next && currentCount >= table.maxCount - 1) {
    const cascaded = resolveAvarieIncrement({ ...exoSheet, [column]: 0 }, next)
    return { ...cascaded, updates: { ...cascaded.updates, [column]: 0 } }
  }

  const itgLoss = currentCount === 0 ? table.itgLossStructure : 0
  return {
    updates: { [column]: currentCount + 1 },
    finalSeverity: severity, destroyed: false, itgLoss,
  }
}

/**
 * Applique une Avarie de `severity` à l'exo-armure `characterId` — cascade de promotion +
 * perte d'ITG Structure éventuelle, en transaction (verrou `.forUpdate()`, même patron que
 * `coldExposureService.js`/`fatigueService.js` : plusieurs coups simultanés sur la même exo au même
 * Tour, rafale ou plusieurs attaquants, ne doivent jamais se marcher dessus). Émet
 * `WS.EXO_AVARIE_UPDATED`. Retourne `null` si `severity` absent, `exo_sheet` introuvable, ou échec.
 */
export async function applyExoAvarie(io, db, campaignId, { characterId, severity }) {
  if (!severity) return null

  let result
  try {
    result = await db.transaction(async (trx) => {
      const exoSheet = await trx('exo_sheet').where({ character_id: characterId }).forUpdate().first()
      if (!exoSheet) return null

      const { updates, finalSeverity, destroyed, itgLoss } = resolveAvarieIncrement(exoSheet, severity)
      const dbUpdates = { ...updates }
      if (itgLoss > 0) {
        dbUpdates.itg_structure_current = Math.max(0, exoSheet.itg_structure_current - itgLoss)
      }

      const [updated] = await trx('exo_sheet')
        .where({ character_id: characterId })
        .update(dbUpdates)
        .returning('*')
      return { exoSheet: updated, finalSeverity, destroyed, itgLoss }
    })
  } catch (err) {
    console.error('[exoAvarieService] applyExoAvarie — échec :', characterId, severity, err.message)
    return null
  }
  if (!result) return null

  io.to(campaignId).emit(WS.EXO_AVARIE_UPDATED, {
    characterId,
    exoSheet: result.exoSheet,
    finalSeverity: result.finalSeverity,
    destroyed: result.destroyed,
    itgLoss: result.itgLoss,
  })

  return result
}

/**
 * Retire une Avarie de `severity` à l'exo-armure `characterId` — outil de correction MJ
 * (PLAN_EXOARMURE.md §13.2), pas la Réparation RAW (Test de Mécanique, Lot séparé). Décrémente le
 * compteur, plancher à 0 — ne restaure JAMAIS l'ITG perdue ni ne redéfait une cascade de promotion
 * passée (documenté, pas un oubli : symétrique en écriture avec applyExoAvarie, pas en effet).
 * Émet `WS.EXO_AVARIE_UPDATED` **seulement si le compteur a réellement bougé** (`finalSeverity`/
 * `destroyed`/`itgLoss` neutres, même forme qu'applyExoAvarie) — un compteur déjà à 0 est un succès
 * silencieux, pas une diffusion à toute la campagne pour rien. Retourne `null` si `severity` est
 * `'destruction'` ou inconnue (aucune colonne à décrémenter, RAW : "pas de case" pour ce palier), ou
 * si `exo_sheet` introuvable.
 */
export async function removeExoAvarie(io, db, campaignId, { characterId, severity }) {
  const column = COLUMN_BY_SEVERITY[severity]
  if (!column) return null

  let result
  try {
    result = await db.transaction(async (trx) => {
      const exoSheet = await trx('exo_sheet').where({ character_id: characterId }).forUpdate().first()
      if (!exoSheet) return null

      const currentCount = exoSheet[column] ?? 0
      if (currentCount === 0) return { exoSheet, changed: false }

      const [updated] = await trx('exo_sheet')
        .where({ character_id: characterId })
        .update({ [column]: currentCount - 1 })
        .returning('*')
      return { exoSheet: updated, changed: true }
    })
  } catch (err) {
    console.error('[exoAvarieService] removeExoAvarie — échec :', characterId, severity, err.message)
    return null
  }
  if (!result) return null

  if (result.changed) {
    io.to(campaignId).emit(WS.EXO_AVARIE_UPDATED, {
      characterId,
      exoSheet: result.exoSheet,
      finalSeverity: null,
      destroyed: false,
      itgLoss: 0,
    })
  }

  return result
}

/**
 * Orchestrateur unique "cette exo-armure vient d'encaisser `degautsBruts`" — point de couture
 * partagé par tous les sites `cibleType === 'exo'` de `socketCombatHelpers.js`
 * (PLAN_EXOARMURE.md §11.4, catégories A et B), pour ne jamais dupliquer la chaîne
 * `resolveExoContext` → `calcExoDegatsNets` → `severityForExoDamage` → `applyExoAvarie` à 6+ endroits.
 * N'émet PAS `COMBAT_ATTACK_RESULT` (le format de ce broadcast varie par site — localisation,
 * roll/chancesDeReussite, etc. — laissé au caller, même invariant que `resolveDroneIntegrityLoss` qui
 * n'émet que `DRONE_INTEGRITY_UPDATED`, jamais `COMBAT_ATTACK_RESULT` à sa place).
 *
 * Retourne `null` si l'exo n'a pas de base configurée (`exoSheet.category` NULL, nouvelle sentinelle
 * Lot B §13.3 — aucune stat effective calculable, `computeExoStats`/`calcExoDegatsNets`) — sinon
 * `{ bld, rd, degatsNets, severity, destroyed, itgLoss }` (`severity`/`destroyed`/`itgLoss` valent
 * `null`/`false`/`0` si `degatsNets` reste sous le seuil Légère, aucune Avarie à appliquer).
 */
export async function resolveExoDamage(io, db, campaignId, { characterId, degautsBruts }) {
  const { exoSheet } = await resolveExoContext(db, { id: characterId })
  if (!exoSheet) return null

  const netResult = calcExoDegatsNets(exoSheet, degautsBruts)
  if (!netResult) return null

  const { bld, rd, degatsNets } = netResult
  const severity = severityForExoDamage(degatsNets)
  if (!severity) return { bld, rd, degatsNets, severity: null, destroyed: false, itgLoss: 0 }

  const avarie = await applyExoAvarie(io, db, campaignId, { characterId, severity })
  return {
    bld, rd, degatsNets, severity,
    destroyed: avarie?.destroyed ?? false,
    itgLoss:   avarie?.itgLoss ?? 0,
  }
}
