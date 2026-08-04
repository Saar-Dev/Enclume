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
  { min: 0, max: 2, modifier: 0, key: 'deJustesse' },
  { min: 3, max: 4, modifier: 1, key: 'correct' },
  { min: 5, max: 6, modifier: 2, key: 'assezBon' },
  { min: 7, max: 9, modifier: 3, key: 'bon' },
  { min: 10, max: 12, modifier: 4, key: 'tresBon' },
  { min: 13, max: 14, modifier: 5, key: 'excellent' },
  { min: 15, max: 19, modifier: 6, key: 'parfait' },
  { min: 20, max: 24, modifier: 7, key: 'extraordinaire' },
  { min: 25, max: 34, modifier: 8, key: 'heroique' },
  { min: 35, max: null, modifier: 9, key: 'legendaire' },

  // ── Échecs (mr < 0) ──
  { min: -2, max: -1, modifier: 0, key: 'deJustesse' },
  { min: -4, max: -3, modifier: -1, key: 'mediocre' },
  { min: -6, max: -5, modifier: -2, key: 'assezMauvais' },
  { min: -9, max: -7, modifier: -3, key: 'mauvais' },
  { min: -12, max: -10, modifier: -4, key: 'tresMauvais' },
  { min: -14, max: -13, modifier: -5, key: 'execrable' },
  { min: -19, max: -15, modifier: -6, key: 'catastrophique' }, // Catastrophique (risque)
  { min: -24, max: -20, modifier: -7, key: 'catastrophique' }, // Catastrophique (risque)
  { min: -34, max: -25, modifier: -8, key: 'catastrophique' }, // Catastrophique (risque)
  { min: null, max: -35, modifier: -9, key: 'catastrophique' }, // Catastrophique (risque) — pas de plancher (symétrique du null haut)
]

export function getMrModifier(mr) {
  const row = MR_TABLE.find(r => (r.min === null || mr >= r.min) && (r.max === null || mr <= r.max))
  return row?.modifier ?? 0
}

// getMrDegreeKey(mr) — clé de degré (LdB p.203-204, table "Marges & modificateurs"), pas de texte.
// Résolue en FR côté client via t('combat.degree.' + clé) — le serveur (qui appelle aussi mr) ne
// consomme jamais cette clé, il transmet mr tel quel (§4 LOCALISATION.md, aucun texte FR figé côté
// serveur).
export function getMrDegreeKey(mr) {
  const row = MR_TABLE.find(r => (r.min === null || mr >= r.min) && (r.max === null || mr <= r.max))
  return row?.key ?? null
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

// getCriticalSuccessBonus({ masteryLevel, attributeAN }) — RAW p.204, "RÉUSSITE CRITIQUE" :
// autorité unique des DEUX formules du bonus de Réussite critique. Un appelant ne calcule jamais
// lui-même `mastery` ou `Math.floor(AN/2)` — il fournit la donnée brute dont il dispose (niveau de
// maîtrise pour un Test de Compétence, AN pour un Test d'Attribut seul) et cette fonction choisit
// la formule. Centralisé ici pour la même raison que resolveTestOutcome (§ en tête de fichier) :
// évite que chaque site (combat CaC/Tir, poussée/traction, interactions, drone, macros) réinvente
// sa propre variante et diverge silencieusement — un seul des deux champs doit être fourni.
// - Test de Compétence (`masteryLevel`) : le bonus est le niveau de maîtrise tel quel (pas le
//   niveau global base+maîtrise — RAW explicite : "et non le niveau global").
// - Test d'Attribut seul (`attributeAN`, "qui n'a pas de niveau de maîtrise") : moitié de l'AN
//   (Aptitude naturelle, pas le niveau brut — seule conversion RAW confirmée d'un Attribut en
//   score de Test, docs/REGLES/ATTRIBUTS.md:131-148), arrondie à l'entier inférieur.
export function getCriticalSuccessBonus({ masteryLevel, attributeAN } = {}) {
  if (masteryLevel != null) return masteryLevel
  if (attributeAN != null) return Math.floor(attributeAN / 2)
  return 0
}

// applyCriticalSuccessBonus(outcome, bonus) — à appeler quand outcome.isCriticalSuccess est vrai,
// avec `bonus` déjà résolu par getCriticalSuccessBonus ci-dessus. Ajoute le bonus à la Marge de
// réussite. Augmente uniquement le `mr` (donc le degré/modificateur consulté en aval via
// getMrModifier) — jamais le résultat du dé ni isSuccess/isCriticalSuccess eux-mêmes (RAW explicite
// sur ce point : "il s'agit bien d'une augmentation de la Marge de réussite et non pas du résultat
// du dé"). Décision Saar 2026-07-31 : application automatique, pas une option laissée au MJ
// (contrairement aux Catastrophes, qui portent un encadré "OPTIONNEL" explicite dans le livre —
// rien de tel ici).
export function applyCriticalSuccessBonus(outcome, bonus) {
  if (!outcome.isCriticalSuccess || !bonus) return outcome
  return { ...outcome, mr: outcome.mr + bonus }
}
