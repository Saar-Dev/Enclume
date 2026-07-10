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
