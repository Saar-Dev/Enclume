// shared/careerSetbacks.js — OPT-06 (revers) — jet 1D100 obligatoire, narratif uniquement.
// (REGLE_CREATION.txt:1190-1199 : tous les 3 ans au-delà de la 10e année d'expérience CUMULÉE
// toutes carrières confondues, soit 13/16/19/... — distinct du Tirage 1D10 d'OPT-05/Lot 6, qui
// lui est par carrière). Fonctions pures, indépendantes de shared/careerAdvantages.js — mécaniques
// différentes (déclencheur global vs par métier, table à plages vs valeur exacte, obligatoire sans
// alternative vs optionnel avec conversion en points, aucun effet mécanique vs budget d'avantages).

/**
 * @param {number} totalYears — années d'expérience cumulées, toutes carrières confondues
 * @returns {number} nombre de tranches dues (0 avant l'an 13, +1 tous les 3 ans ensuite)
 */
export function getSetbackBlockCount(totalYears) {
  return Math.max(0, Math.floor((totalYears - 10) / 3))
}

/**
 * @param {number} roll — résultat 1D100
 * @param {{roll_min:number, roll_max:number}[]} setbackRows — ref_setbacks
 * @returns {object|null} la ligne dont la plage couvre `roll`, ou null si hors bornes (1-100)
 */
export function resolveSetback(roll, setbackRows) {
  return (setbackRows ?? []).find(r => roll >= r.roll_min && roll <= r.roll_max) ?? null
}

/**
 * Rattachement (carrière, tranche) d'un Revers (§Lot E point 6, PLAN_WIZARD_AVANTAGES.md §17) :
 * une tranche de Revers `blockIndex` correspond à l'année cumulée 13 + 3*blockIndex (déclencheur
 * "tous les 3 ans au-delà de la 10e année", cf. getSetbackBlockCount). Cette fonction traduit cette
 * année cumulée en (index de carrière, tranche de 5 ans DANS cette carrière) en parcourant les
 * carrières du personnage dans l'ordre — nécessaire pour income_multiplier (Renvoi) et le budget
 * d'Avantages professionnels de la carrière concernée ; PAS pour le budget de compétences
 * (character-wide, aucun rattachement nécessaire, careerSkills.js).
 * @param {number} setbackBlockIndex — index de la tranche de Revers (0, 1, 2...)
 * @param {{years:number}[]} careers — carrières du personnage, dans l'ordre choisi par le joueur
 * @returns {{careerIndex:number, blockIndexWithinCareer:number}|null} null si l'année cumulée
 *   dépasse le total des années de carrière (ne devrait pas arriver, déjà validé en amont)
 */
export function mapSetbackToCareerBlock(setbackBlockIndex, careers) {
  const cumulativeYear = 13 + 3 * setbackBlockIndex
  let yearsBefore = 0
  for (let careerIndex = 0; careerIndex < (careers ?? []).length; careerIndex++) {
    const years = careers[careerIndex].years
    if (cumulativeYear <= yearsBefore + years) {
      const yearsIntoCareer = cumulativeYear - yearsBefore // 1..years
      const blockIndexWithinCareer = Math.floor((yearsIntoCareer - 1) / 5)
      return { careerIndex, blockIndexWithinCareer }
    }
    yearsBefore += years
  }
  return null
}
