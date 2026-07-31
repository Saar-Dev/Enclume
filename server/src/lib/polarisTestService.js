import { parseDice } from './diceParser.js'
import { resolveTestOutcome, applyCriticalFailReroll, applyCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'

// Résolveur générique de Test Polaris — RAW p.201-205, docs/PLAN_TEST_CRITIQUE.md. Délègue la
// règle marge/critique/Catastrophe à resolveTestOutcome (shared/polarisTestResolution.js), même
// autorité que combatAttackRoll.js — plus aucune copie locale de la règle. Point d'entrée unique :
// tout appelant (macro joueur via socket, échéance serveur autonome) partage cette même règle.
//
// criticalSuccessBonus (Lot 2, p.204) : déjà résolu par l'appelant via getCriticalSuccessBonus
// (niveau de maîtrise ou moitié d'AN selon le type de Test) — cette fonction reste agnostique du
// type de Test (macro composite, échéance...), elle ne fait qu'appliquer le nombre reçu. Défaut 0 :
// les appelants qui n'ont pas de Compétence/Attribut identifiable (échéances environnementales
// Chute/Fatigue/Infection...) ne changent pas de comportement.
//
// Sur Échec critique (roll===20), le Livre de Base impose un retest (p.204) : cette fonction fait
// elle-même le second jet (contrairement à combatAttackRoll.js, noyau pur sans I/O) puisqu'elle
// possède déjà son propre parseDice.
export async function resolvePolarisTest(threshold, criticalSuccessBonus = 0) {
  const { total: roll, seed } = await parseDice('1d20')
  let outcome = applyCriticalSuccessBonus(resolveTestOutcome(roll, threshold), criticalSuccessBonus)
  let criticalFailReroll = null

  if (outcome.isCriticalFail) {
    const { total: reroll } = await parseDice('1d20')
    criticalFailReroll = reroll
    outcome = applyCriticalFailReroll(outcome, reroll)
  }

  return { roll, threshold, seed, criticalFailReroll, ...outcome }
}
