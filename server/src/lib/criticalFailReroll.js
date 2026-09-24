import { parseDice } from './diceParser.js'
import { applyCriticalFailReroll } from '../../../shared/polarisTestResolution.js'

// ─── Helper — retest d'Échec critique (RAW p.204, docs/PLAN_TEST_CRITIQUE.md) ─────────────────────
// computeAttackRoll (noyau pur) ne peut pas faire ce second jet lui-même (pas d'I/O dans le noyau,
// PLAN_RW_SYSCOMBAT.md §2.1.c) — chaque site qui appelle computeAttackRoll sur un jet frais (attaque
// ou défense, jamais une relecture depuis combat_pending) passe son résultat ici juste après.
// Sans effet si l'issue n'est pas un Échec critique.
//
// Extrait de socketCombatHelpers.js (réexporté par ce fichier, imports existants inchangés) pour que les
// services `lib/` (ex. droneInterceptionService) l'utilisent sans import circulaire vers un socket.
export async function resolveCriticalFailReroll(outcome) {
  if (!outcome.isCriticalFail) return outcome
  const { total: reroll } = await parseDice('1d20')
  return applyCriticalFailReroll(outcome, reroll)
}
