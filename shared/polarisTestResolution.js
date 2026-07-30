// Résolution des Tests Polaris — Livre de Base p.201-205 (§ "Résolution des Tests" +
// "Réussites et échecs critiques" + "Catastrophes (optionnel)").
// Autorité unique de la règle marge/critique/Catastrophe — combatAttackRoll.js (combat),
// polarisTestService.js (Tests génériques) et tout futur Test contre un Seuil appellent
// resolveTestOutcome ici plutôt que de recalculer leur propre version (cause racine de
// docs/PLAN_TEST_CRITIQUE.md : la règle avait divergé parce qu'elle était copiée à la main
// à chaque site).
//
// RAW (p.203) : la Marge de réussite est le résultat du dé lu directement (pas seuil-roll) ;
// la Marge d'échec est le nombre de points au-dessus du Seuil (roll-seuil). Les deux sont
// unifiées ici dans un seul `mr` signé (positif = réussite, négatif = échec) pour rester
// compatible avec MR_TABLE ci-dessous, qui utilise déjà cette convention signée.

// Table LdB p.209 (ex-migration 46 `polaris_mr`) — donnée RAW statique, jamais éditée en jeu
// (aucune route ne la modifie, vérifié) : même statut que AN_TABLE, pas de raison de vivre en DB.
export const MR_TABLE = [
  // ── Réussites (mr >= 0) ──
  { min: 0, max: 2, modifier: 0 },   // De justesse
  { min: 3, max: 4, modifier: 1 },   // Correct
  { min: 5, max: 6, modifier: 2 },   // Assez bon
  { min: 7, max: 9, modifier: 3 },   // Bon
  { min: 10, max: 12, modifier: 4 }, // Très bon
  { min: 13, max: 14, modifier: 5 }, // Excellent
  { min: 15, max: 19, modifier: 6 }, // Parfait
  { min: 20, max: 24, modifier: 7 }, // Extraordinaire
  { min: 25, max: 34, modifier: 8 }, // Héroïque
  { min: 35, max: null, modifier: 9 }, // Légendaire

  // ── Échecs (mr < 0) ──
  { min: -2, max: -1, modifier: 0 },    // De justesse
  { min: -4, max: -3, modifier: -1 },   // Médiocre
  { min: -6, max: -5, modifier: -2 },   // Assez mauvais
  { min: -9, max: -7, modifier: -3 },   // Mauvais
  { min: -12, max: -10, modifier: -4 }, // Très mauvais
  { min: -14, max: -13, modifier: -5 }, // Exécrable
  { min: -19, max: -15, modifier: -6 }, // Catastrophique (risque)
  { min: -24, max: -20, modifier: -7 }, // Catastrophique (risque)
  { min: -34, max: -25, modifier: -8 }, // Catastrophique (risque)
  { min: null, max: -35, modifier: -9 }, // Catastrophique (risque) — pas de plancher (symétrique du null haut)
]

export function getMrModifier(mr) {
  const row = MR_TABLE.find(r => (r.min === null || mr >= r.min) && (r.max === null || mr <= r.max))
  return row?.modifier ?? 0
}

// Seuil de Marge d'échec (en valeur absolue) à partir duquel une Catastrophe devient possible
// (p.204, "CATASTROPHES (OPTIONNEL)") — jamais automatique, décision MJ. Exposé comme un simple
// flag de risque, jamais imposé par le moteur.
const CATASTROPHE_MARGE_MIN = 15

// resolveTestOutcome(roll, seuil) — un jet déjà effectué (roll) contre un Seuil déjà calculé
// (seuil = chances de réussite finales, modificateur de Difficulté déjà inclus).
// Fonction pure — aucun jet de dé ici (un jet déjà fait entre en paramètre), donc réutilisable
// aussi bien par un noyau combat pur que par un résolveur qui fait son propre jet.
//
// Règles couvertes :
// - Réussite critique = roll === seuil, SAUF si seuil >= 20 : dans ce cas aucun échec n'est
//   possible et seul un roll de 20 compte comme critique (p.205, "Chances de réussite
//   supérieures à 20") — les deux conditions sont réunies dans une seule expression ci-dessous.
// - Échec critique = roll === 20 sur un Test qui peut effectivement échouer (seuil < 20).
//   Le retest (reroll + cumul sur la marge) n'est PAS fait ici : voir applyCriticalFailReroll,
//   qui a besoin d'un jet supplémentaire déjà effectué par l'appelant (cette fonction reste pure).
export function resolveTestOutcome(roll, seuil) {
  const isSuccess = roll <= seuil
  const isCriticalFail = !isSuccess && roll === 20
  const isCriticalSuccess = isSuccess && (roll === seuil || (seuil >= 20 && roll === 20))
  const mr = isSuccess ? roll : seuil - roll
  const catastropheRisk = !isSuccess && mr <= -CATASTROPHE_MARGE_MIN

  return { isSuccess, isCriticalSuccess, isCriticalFail, mr, catastropheRisk }
}

// applyCriticalFailReroll(outcome, rerollValue) — à appeler quand outcome.isCriticalFail est vrai
// et que l'appelant a déjà relancé un D20 (p.204, "ÉCHEC CRITIQUE" : "Relancez alors le D20 et
// ajoutez le résultat à la Marge d'échec initiale"). Recalcule aussi le risque de Catastrophe,
// qui ne peut être franchi qu'après ce cumul.
export function applyCriticalFailReroll(outcome, rerollValue) {
  if (!outcome.isCriticalFail) return outcome
  const mr = outcome.mr - rerollValue
  return { ...outcome, mr, catastropheRisk: mr <= -CATASTROPHE_MARGE_MIN }
}
