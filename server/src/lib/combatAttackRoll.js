import { resolveTestOutcome } from '../../../shared/polarisTestResolution.js'

/**
 * combatAttackRoll.js — Noyau pur du jet d'attaque combat (CaC + Tir)
 *
 * Fonction PURE — aucun accès DB, aucune I/O (pas de console.log), aucun appel non déterministe.
 * Toutes les données sont passées en paramètre, y compris le jet de dé déjà effectué (parseDice
 * reste dans l'appelant : crypto.randomInt n'accepte aucune graine, l'appeler ici rendrait la
 * fonction non testable — PLAN_RW_SYSCOMBAT.md §2.1.c).
 *
 * Pattern « liste de contributions » (PLAN_RW_SYSCOMBAT.md §1.5, même principe que le
 * StatisticModifier de foundryvtt/pf2e) : l'appelant assemble la liste ordonnée des modificateurs
 * { label, value, type }, le noyau somme, filtre les zéros et assemble le breakdown. Ajouter un
 * modificateur au jeu = ajouter une entrée à la liste chez l'appelant — jamais toucher cette fonction.
 *
 * Garanties de forme (verrouillées par combatAttackRoll.test.mjs) :
 * - breakdown[0] = { label: skillLabel, value: skillTotal, type: 'base' }
 * - puis les contributions non nulles, dans l'ordre fourni (l'ordre EST l'ordre d'affichage client)
 * - breakdown[dernier] = { label: totalLabel, value: seuil, type: 'total' }
 * - une contribution à zéro est absente du breakdown et ne change pas la somme
 * - deux contributions non nulles qui se compensent sont toutes deux conservées — si un domaine veut
 *   les masquer en bloc quand leur total est nul (mods d'arme, RV2 PLAN_RW_SYSCOMBAT.md §7),
 *   c'est à l'appelant de ne pas les verser dans la liste.
 *
 * isSuccess/isCriticalSuccess/isCriticalFail/mr délégués à resolveTestOutcome (shared/
 * polarisTestResolution.js, docs/PLAN_TEST_CRITIQUE.md) — autorité unique de la règle RAW
 * marge/critique, plus jamais recalculée ici ou chez l'appelant. Sur isCriticalFail, l'appelant
 * doit relancer un D20 et appliquer applyCriticalFailReroll (cette fonction reste pure, donc ne
 * fait pas ce second jet elle-même).
 */
export function computeAttackRoll({ skillLabel, skillTotal, contributions, totalLabel, rollAttaque }) {
  const kept = contributions.filter(c => c.value !== 0)
  const seuil = skillTotal + kept.reduce((sum, c) => sum + c.value, 0)
  const outcome = resolveTestOutcome(rollAttaque, seuil)
  return {
    seuil,                        // = chancesAttaque (CaC) / chancesDeReussite (Tir)
    breakdown: [
      { label: skillLabel, value: skillTotal, type: 'base' },
      ...kept,
      { label: totalLabel, value: seuil, type: 'total' },
    ],
    ...outcome,
  }
}
