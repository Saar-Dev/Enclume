// server/src/lib/equipmentRepairService.js — domaine « réparation complète du matériel »
// (docs/PLANS/PLAN_USURE&INTEGRITE.md §8, L6). Parallèle à `woundEvolutionService.js` /
// `coldExposureService.js` : chaque domaine porte le handler de son type d'échéance et son
// enrichissement pour l'écran humain, jamais le moteur générique (`echeanceService.js`).
//
// Échéance `equipment_repair` : créée À LA DEMANDE par un joueur (`advance_driven: false`,
// migration 334), directement en `pending_mj_review`. Le MJ approuve (→ `awaiting_player_roll`,
// éventuellement en changeant `payload.skillId`) ou refuse (→ `cancelled`, hors moteur). Le joueur
// lance ensuite son dé (socket `EQUIPMENT_REPAIR_ROLL`, `socketDice.js`), qui fusionne le résultat
// dans `payload.rollResult` puis appelle `resolveEcheanceNow` → ce handler.
//
// Ce handler ne lance jamais de dé (comme `woundInfectionCheckHandler`) : il interprète un résultat
// déjà connu. L'écriture ITG passe par `integrityService.applyRepairOutcome` (invariant #3 :
// autorité d'écriture unique de `char_inventory`).

import * as integrityService from '../services/integrityService.js'

// equipmentRepairHandler(trx, echeance) — contrat de shared/echeanceTypeRegistry.js.
//   payload attendu : { itemId, skillId, ntMalus, rollResult? }
//   - `rollResult` absent  → { resolved: false } (attend le jet du joueur) ;
//   - `rollResult` présent → applique l'issue via integrityService, { resolved: true }.
// Pas de reschedule / spawn (échéance ponctuelle). Pas d'undoEntries : `advance_driven: false`,
// la résolution n'est jamais rejouée par une annulation d'avance ; un retour arrière passe par
// l'éditeur d'ITG du MJ.
export async function equipmentRepairHandler(trx, echeance) {
  const { itemId, rollResult } = echeance.payload ?? {}
  if (!rollResult) return { resolved: false }

  // L'objet a pu être transféré / supprimé entre la demande et le jet — rien à réparer, l'échéance
  // n'a plus d'objet (même repli que woundInfectionCheckHandler quand la blessure a disparu).
  const item = itemId ? await trx('char_inventory').where({ id: itemId }).first() : null
  if (!item) return { resolved: true, reschedule: null, spawn: [], undoEntries: [] }

  const applied = await integrityService.applyRepairOutcome(itemId, { outcome: rollResult }, trx)

  return {
    resolved: true,
    effects: { kind: 'equipmentRepairResult', itemId, result: applied.repair, points: applied.points ?? 0 },
    reschedule: null,
    spawn: [],
    undoEntries: [],
  }
}
