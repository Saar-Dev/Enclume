// shared/exoStats.js — Statistiques effectives (dérivées) d'une exo-armure
//
// Jamais stockées, recalculées à chaque lecture à partir de l'Intégrité courante des composants
// (décision PLAN_EXOARMURE.md §1.7, patron "derived data" Foundry/Lancer déjà validé §4 du même
// plan). Fonction pure, aucun accès DB — le join exo_sheet -> ref_exo_templates reste à la charge de
// l'appelant (PLAN_COMBATANT_CONTEXT.md §3.4, resolveExoTestContext).
//
// Formules RAW : docs/REGLES/REGLEARMURE.md p.328-329 (lignes 565-621) — paliers d'Intégrité
// Exosquelette (EXF), Structure (Blindage), Générateur (réduction supplémentaire d'EXF à ITG<=5).
// Deux points laissés ouverts par le texte RAW lui-même, tranchés par Saar (session 2026-08-13/14) :
//   - Exosquelette et Générateur réduisent l'EXF de façon cumulative, pas indépendante. Combinés en
//     UNE SEULE multiplication suivie d'un seul arrondi (pas deux floor successifs) : exo_sheet ne
//     conserve aucun historique de quel composant a été touché en premier (§1.7, "stats effectives
//     jamais stockées ... recalculées à chaque lecture" — pas de journal d'événements à rejouer dans
//     un ordre), donc les deux facteurs s'appliquent simultanément, jamais l'un après l'autre. Un
//     double floor séquentiel introduirait un ordre arbitraire non RAW (vérifié par calcul exhaustif :
//     floor(floor(x*a)*b) != floor(floor(x*b)*a) dans 225 cas sur la plage EXF 20-70/Intégrité 0-15) —
//     la multiplication étant commutative, un floor unique élimine cet artefact au lieu de trancher un
//     ordre qui n'a pas de sens ici.
//   - Générateur à Intégrité <= 0 : EXF = 0. Le RAW ne le dit pas explicitement (seulement "l'armure
//     n'est plus alimentée"), interprété comme un exosquelette non alimenté ne produisant plus de
//     force.
import { EXO_RD_TABLE } from './exoConstants.js'

// Palier Structure (Blindage) et palier Exosquelette (premier facteur EXF) partagent les mêmes
// seuils/facteurs (REGLEARMURE.md:565-570 et :617-619) — une seule fonction pour les deux.
// itg_*_current est NOT NULL en base (migration 233) — le repli sur 0 (palier "détruit", le plus
// défavorable) ne couvre qu'un appelant malformé, jamais une ligne exo_sheet réelle.
function integrityFactor(itg) {
  const value = itg ?? 0
  if (value >= 11) return 1
  if (value >= 6) return 2 / 3
  if (value >= 1) return 1 / 2
  return 0
}

// Palier Générateur — aucun effet sur l'EXF à Intégrité 6-10 (seuls Systèmes auxiliaires/Vitesse du
// propulseur y sont affectés, REGLEARMURE.md:585-590) ; réduction propre à partir de <= 5
// (REGLEARMURE.md:595-596, "également divisée par deux") ; destruction à <= 0 (:597-599, EXF=0 par
// décision Saar ci-dessus — non explicite au RAW).
function generatorExfFactor(itg) {
  const value = itg ?? 0
  if (value >= 6) return 1
  if (value >= 1) return 1 / 2
  return 0
}

/**
 * Statistiques effectives d'une exo-armure — EXF/BLD/RD dérivés de l'Intégrité courante des
 * composants. `vit` n'est volontairement pas retourné ici : porté par movementBudgetService.js
 * (autorité unique du mouvement, PLAN_EXOARMURE.md §7.4) — un doublon créerait une deuxième
 * autorité sur la même donnée.
 *
 * @param {object} exoSheet — ligne exo_sheet (itg_structure_current, itg_exosquelette_current,
 *   itg_generator_current, category, base_exoforce, base_blindage — ces 3 derniers copiés depuis
 *   le modèle choisi par applyExoTemplate, PLAN_EXOARMURE.md §13.3 Lot B ; plus de second paramètre
 *   `template`, `exo_sheet` porte désormais sa propre base éditable, autorité unique)
 * @returns {{exf: number, bld: number, rd: number}|null} null si `category` est NULL ("armure non
 *   configurée", nouvelle sentinelle Lot B — remplace l'ancien `template_id IS NULL` du Lot 1 §6.5) —
 *   aucune stat effective n'est calculable (jamais un NaN/undefined silencieux)
 */
export function computeExoStats(exoSheet) {
  if (exoSheet.category == null) return null

  const exoFactor = integrityFactor(exoSheet.itg_exosquelette_current)
  const genFactor = generatorExfFactor(exoSheet.itg_generator_current)
  const exf = Math.floor((exoSheet.base_exoforce ?? 0) * exoFactor * genFactor)

  const structureFactor = integrityFactor(exoSheet.itg_structure_current)
  const bld = Math.floor((exoSheet.base_blindage ?? 0) * structureFactor)

  if (!(exoSheet.category in EXO_RD_TABLE)) {
    throw new Error(`computeExoStats: catégorie exo inconnue de EXO_RD_TABLE : ${exoSheet.category}`)
  }
  const rd = EXO_RD_TABLE[exoSheet.category]

  return { exf, bld, rd }
}
