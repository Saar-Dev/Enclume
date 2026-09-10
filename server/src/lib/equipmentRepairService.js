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

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { calcSkillTotal } from './charStats.js'
import { loadCharacterTestContext } from './characterTestContext.js'
import * as integrityService from '../services/integrityService.js'

// computeRepairThreshold(characterId, campaignId, { skillId, ntMalus }) — Seuil d'un Test de
// réparation complète. Autorité UNIQUE de ce calcul : appelé par le socket EQUIPMENT_REPAIR_ROLL
// (jet réel) ET par la route repair-preview (affichage joueur) → le Seuil montré est toujours celui
// qui sera lancé. Seuil = compétence (calcSkillTotal, mêmes règles que MACRO_ROLL / char-sheet) +
// malus NT (§5.1) + malus actifs (blessures / fatigue / encombrement — comme tout Test de
// compétence). `ntMalus` et `activeMalus` sont ≤ 0.
export async function computeRepairThreshold(characterId, campaignId, { skillId, ntMalus = 0 } = {}) {
  const ctx = await loadCharacterTestContext(db, campaignId, characterId)
  if (!ctx) throw new AppError(404, 'Fiche du personnage introuvable')
  const [charSkill, refSkill] = await Promise.all([
    db('char_skills').where({ char_sheet_id: ctx.sheet.id, skill_id: skillId }).first(),
    db('ref_skills').where({ id: skillId }).first(),
  ])
  if (!refSkill) throw new AppError(400, `Compétence de réparation invalide : ${skillId}`)

  const skillTotal = calcSkillTotal(ctx.attrs, charSkill, refSkill, ctx.genotypeRow, ctx.mutationEffects)
  const nt = ntMalus ?? 0
  return {
    skillId,
    skillLabel: refSkill.label,
    skillTotal,
    ntMalus: nt,
    activeMalus: ctx.activeMalus,
    threshold: skillTotal + nt + ctx.activeMalus,
  }
}

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
