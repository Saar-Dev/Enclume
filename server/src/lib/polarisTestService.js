import { parseDice } from './diceParser.js'
import { resolveTestOutcome, applyCriticalFailReroll } from '../../../shared/polarisTestResolution.js'

// Résolveur générique de Test Polaris — RAW p.201-205, docs/PLAN_TEST_CRITIQUE.md. Délègue la
// règle marge/critique/Catastrophe à resolveTestOutcome (shared/polarisTestResolution.js), même
// autorité que combatAttackRoll.js — plus aucune copie locale de la règle. Point d'entrée unique :
// tout appelant (macro joueur via socket, échéance serveur autonome) partage cette même règle.
//
// Sur Échec critique (roll===20), le Livre de Base impose un retest (p.204) : cette fonction fait
// elle-même le second jet (contrairement à combatAttackRoll.js, noyau pur sans I/O) puisqu'elle
// possède déjà son propre parseDice.
export async function resolvePolarisTest(threshold) {
  const { total: roll, seed } = await parseDice('1d20')
  let outcome = resolveTestOutcome(roll, threshold)
  let criticalFailReroll = null

  if (outcome.isCriticalFail) {
    const { total: reroll } = await parseDice('1d20')
    criticalFailReroll = reroll
    outcome = applyCriticalFailReroll(outcome, reroll)
  }

  return { roll, threshold, seed, criticalFailReroll, ...outcome }
}
