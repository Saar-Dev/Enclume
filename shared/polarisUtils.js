// Arrondi Polaris : 0.5 arrondit vers le bas (LdB convention, ≠ Math.round)
export function polarisRound(x) {
  return Math.floor(x + 0.4)
}

// Table na → Aptitude Naturelle (LdB)
export const AN_TABLE = [
  { min: 3,  max: 3,  an: -4 },
  { min: 4,  max: 4,  an: -3 },
  { min: 5,  max: 5,  an: -2 },
  { min: 6,  max: 7,  an: -1 },
  { min: 8,  max: 9,  an:  0 },
  { min: 10, max: 12, an:  1 },
  { min: 13, max: 15, an:  2 },
  { min: 16, max: 18, an:  3 },
  { min: 19, max: 21, an:  4 },
  { min: 22, max: 24, an:  5 },
  { min: 25, max: Infinity, an: 6 },
]

export function calcAN(na) {
  const entry = AN_TABLE.find(e => na >= e.min && na <= e.max)
  return entry ? entry.an : -4
}

// ─── Résolution des modificateurs d'attribut (génotype / mutation) ───────────
// Point de calcul unique partagé client/serveur — voir docs/PLAN_MUTATION2.md Lot 1.
// ADA/PER absents de ATTR_TO_MUTATION_MOD : aucune mutation ne cible ces deux attributs.
export const ATTR_TO_GENOTYPE_MOD = { FOR: 'mod_for', CON: 'mod_con', COO: 'mod_coo', ADA: 'mod_ada', PER: 'mod_per', INT: 'mod_int', VOL: 'mod_vol', PRE: 'mod_pre' }
export const ATTR_TO_MUTATION_MOD = { FOR: 'mod_FOR', CON: 'mod_CON', COO: 'mod_COO', INT: 'mod_INT', VOL: 'mod_VOL', PRE: 'mod_PRE' }

export function getGenotypeModForAttr(genotypeRow, attrId) {
  if (!genotypeRow) return 0
  const col = ATTR_TO_GENOTYPE_MOD[attrId]
  return col ? (genotypeRow[col] ?? 0) : 0
}

export function getMutationModForAttr(mutationEffectsRow, attrId) {
  if (!mutationEffectsRow) return 0
  const col = ATTR_TO_MUTATION_MOD[attrId]
  return col ? (mutationEffectsRow[col] ?? 0) : 0
}

// TOTAL_MALUS = 0 en V1 — historique XP non implémenté (voir server/src/lib/charStats.js).
const TOTAL_MALUS = 0

// Niveau d'Attribut net (na) — plancher 3. Source de vérité pour calcAttributeAN/NA (serveur)
// et pour l'affichage fiche/combat (client) — un seul calcul, deux consommateurs indépendants.
export function calcNA(base_level, pc_modifier, mod_genotype, mod_mutation) {
  const raw = (base_level ?? 7) + (pc_modifier ?? 0) + (mod_genotype ?? 0) + (mod_mutation ?? 0) - TOTAL_MALUS
  return Math.max(3, raw)
}

// Allures de déplacement (LdB p.221)
export function calcAllureMoy(val) {
  if (val <= 5)  return 6
  if (val <= 10) return 8
  if (val <= 15) return 10
  if (val <= 20) return 12
  if (val <= 25) return 14
  return 16 + 2 * Math.floor((val - 26) / 5)
}

export function calcAllures(coo_na, athletisme_total) {
  const moy    = calcAllureMoy(coo_na)
  const maxMoy = calcAllureMoy(athletisme_total ?? 2)
  return { lente: moy / 2, moyenne: moy, rapide: moy * 2, max: maxMoy * 4 }
}

// Allures de repli pour PNJs sans stats (équivalent COO=10)
export const DEFAULT_PNJ_ALLURES = { lente: 4, moyenne: 8, rapide: 16, max: 24 }

// Nombre de Points de Création (PC) en fonction de l'ambiance
export const POOL_AMBIANCE = {
  REALISTE: 30,
  INTERMEDIAIRE: 38,
  HEROIQUE: 46,
};

// Chance en focntion de l'ambiance
export const CHANCE_AMBIANCE = {
  REALISTE: 11,
  INTERMEDIAIRE: 13,
  HEROIQUE: 15,
};

/**
 * Effets de l'âge sur les Attributs (malus cumulatifs).
 * Règles LdB — choix parmi les attributs listés. MVP : premier(s) de la liste.
 * Malus 16-19 ans (REGLE_CREATION.txt, "PERSONNAGES TRÈS JEUNES (OPTIONNEL)") gaté par
 * ctx.youngPenaltyEnabled (option young_penalty, défaut OFF) — non applicable par attribut si
 * son "Niveau de base" (ctx.attributes, avant tout modificateur) est déjà ≤7.
 * @param {number} age
 * @param {object} [ctx] - { attributes?: {FOR,PRE}, youngPenaltyEnabled?: boolean }
 * @returns {{ FOR?: number, CON?: number, COO?: number, ADA?: number, PER?: number, PRE?: number }}
 */
export function getAgeEffects(age, ctx = {}) {
  if (age >= 41) return { FOR: -1, CON: -1, COO: -1, ADA: -1, PER: -1 }
  if (age >= 36) return { FOR: -1, CON: -1 }
  if (age >= 30) return { FOR: -1 }
  if (ctx.youngPenaltyEnabled && age >= 16 && age <= 19) {
    const attrs = ctx.attributes || {}
    const effects = {}
    if (age <= 17) {
      if ((attrs.FOR ?? 0) > 7) effects.FOR = -3
      if ((attrs.PRE ?? 0) > 7) effects.PRE = -2
    } else if (age === 18) {
      if ((attrs.FOR ?? 0) > 7) effects.FOR = -2
      if ((attrs.PRE ?? 0) > 7) effects.PRE = -1
    } else if (age === 19) {
      if ((attrs.FOR ?? 0) > 7) effects.FOR = -1
    }
    return effects
  }
  return {}
}
/**
 * Calcule le coût en points pour atteindre un niveau de maîtrise cible.
 * @param {string} skillId — ID de la compétence
 * @param {number|null} currentMastery — niveau actuel (null si jamais apprise)
 * @param {number} targetMastery — niveau visé
 * @param {boolean} isPro — true = compétence professionnelle (coût normal)
 * @param {boolean} isLearned — true si compétence réservée déjà ouverte
 * @param {object[]} refSkills — liste des compétences de référence (pour markers)
 * @returns {{ cost: number, erreur?: string }}
 */
export function calcSkillCost(skillId, currentMastery, targetMastery, isPro, isLearned, refSkills) {
  const skill = refSkills.find(s => s.id === skillId)
  const marker = skill?.marker

  // Compétence réservée non apprise
  if (marker === '(X)' && !isLearned && targetMastery > 0) {
    return { cost: Infinity, erreur: 'Compétence réservée — payer 1 pt pour débloquer (niveau -3)' }
  }

  // Progression Naturelle : gratuit jusqu'à +5
  if (marker === 'PN' && targetMastery <= 5) {
    return { cost: 0 }
  }

  let cost = 0
  let current = currentMastery ?? null

  // Si réservée jamais apprise, le joueur doit d'abord l'ouvrir
  if (marker === '(X)' && current === null && targetMastery >= -3) {
    cost += 1  // 1 pt pour ouvrir
    current = -3
  }

  // Si le joueur ne veut que débloquer sans monter
  if (current === -3 && targetMastery === -3) {
    return { cost }
  }

  // Progression de current+1 à targetMastery
  for (let level = (current ?? 0) + 1; level <= targetMastery; level++) {
    if (level <= 0) cost += 1
    else if (level <= 5) cost += 1
    else if (level <= 10) cost += 2
    else if (level === 11) cost += 3
    else if (level === 12) cost += 5
    else if (level === 13) cost += 7
    else cost += (level - 11) * 2
  }

  if (!isPro) cost *= 2
  return { cost }
}

/**
 * Niveau de maîtrise maximum par années d'expérience dans la profession.
 */
export function getMaxMasteryByYears(years) {
  if (years >= 21) return 15
  if (years >= 11) return 13
  if (years >= 6) return 10
  if (years >= 3) return 7
  if (years >= 2) return 5
  return 3
}


// Coût cumulatif pour atteindre un niveau donné
// Les clés 5 et 6 permettent le calcul correct pour base_initiale = 5 (FOR féminin)
export const COST_LOOKUP = {
  5: 0, 6: 0,
  7: 0,          // Base de départ standard
  8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 13: 6, 14: 7, 15: 8,
  16: 10,        // +2 (premier niveau à coût double)
  17: 12,        // +2
  18: 14,        // +2
  19: 17,        // +3 (premier niveau à coût triple)
  20: 20,        // +3
};

export const PC_MAX_ETAPE1 = 8;  // 8 PC = +16 points max

export function calcPoolTotal(ambiance, pcDispo) {
  return POOL_AMBIANCE[ambiance] + (pcDispo * 2);
}
// 1 PC = +2 points d'Attributs (table p.118 du LdB)

export function calcAttributCost(valeurCible, baseInitiale = 7) {
  return COST_LOOKUP[valeurCible] - COST_LOOKUP[baseInitiale];
}
// baseInitiale = 7 (standard) ou 5 (FOR d'un personnage féminin)

export function calcTotalCost(attributs, isFeminin) {
  const raw = Object.entries(attributs).reduce((total, [attr, valeur]) => {
    const base = (attr === 'FOR' && isFeminin) ? 5 : 7;
    return total + calcAttributCost(valeur, base);
  }, 0);
  return isFeminin ? raw - getFemininBonusDiscount(attributs) : raw;
}

const SALARY_FORMULA_RE = /^(\d+)D(\d+)\*(\d+)$/

/**
 * Évalue une formule de salaire aléatoire (carrières, ex. '1D6*100').
 * [DETTE-ETAPE4-1] dés aléatoires — une version "moyenne" pourrait être ajoutée plus tard.
 * @param {string} formula — format 'NDF*M' (N dés, F faces, multiplicateur M)
 * @returns {number}
 */
export function evaluateSalaryFormula(formula) {
  if (!formula) return 0
  const match = formula.match(SALARY_FORMULA_RE)
  if (!match) return 0
  const [, diceCount, diceFaces, multiplier] = match
  let total = 0
  for (let i = 0; i < parseInt(diceCount, 10); i++) {
    total += Math.floor(Math.random() * parseInt(diceFaces, 10)) + 1
  }
  return total * parseInt(multiplier, 10)
}

/**
 * Estimation moyenne déterministe d'une formule de salaire, sans tirage aléatoire.
 * Utilisée pour les aperçus lecture seule (Wizard Step4 Lot 3) — le montant réel reste déterminé
 * par evaluateSalaryFormula() à la validation.
 * @param {string} formula — format 'NDF*M'
 * @returns {number}
 */
export function estimateSalaryFormula(formula) {
  if (!formula) return 0
  const match = formula.match(SALARY_FORMULA_RE)
  if (!match) return 0
  const [, diceCount, diceFaces, multiplier] = match
  const avgPerDie = (parseInt(diceFaces, 10) + 1) / 2
  return Math.round(parseInt(diceCount, 10) * avgPerDie * parseInt(multiplier, 10))
}

// Bonus féminin (REGLE_CREATION.txt:293-296) : "Deux bonus de +1 (éventuellement cumulatifs)
// à répartir en Coordination ou Présence" — les 2 premiers points investis en Coordination et/ou
// Présence (combinés, peu importe la répartition) ne coûtent rien. Remise forfaitaire plutôt
// qu'une base décalée par attribut (comme Force) — mathématiquement identique pour toute
// répartition (COST_LOOKUP[7]=0 rend l'algèbre équivalente, vérifié), mais ne nécessite ni état
// ni UI supplémentaire : le spinner Mod.PC existant pour COO/PRE reste inchangé, la remise
// s'applique silencieusement dans le budget (comme la base 5 de Force). Aucune règle à rejeter :
// la remise s'auto-limite à 2 par construction (Math.min), jamais de dépassement possible.
export const FEMININ_BONUS_MAX = 2;

export function getFemininBonusDiscount(attributs) {
  const investedCOO = Math.max(0, attributs['COO'] - 7);
  const investedPRE = Math.max(0, attributs['PRE'] - 7);
  const freePoints = Math.min(FEMININ_BONUS_MAX, investedCOO + investedPRE);
  return calcAttributCost(7 + freePoints, 7);
}

export function validateStep1(attributs, ambiance, pcDispo, isFeminin) {
  const erreurs = [];
  const poolTotal = calcPoolTotal(ambiance, pcDispo);
  const totalCost = calcTotalCost(attributs, isFeminin);

  // G1 : Budget exact — NON bloquant (UI Session 141 suite 10) : un budget non totalement dépensé
  // ne viole aucune règle (les points restants sont juste perdus), contrairement à G2/G3/G4 qui
  // sont de vraies bornes de règle. Signalé via budgetIncomplete, jamais dans `erreurs`/`valide`.
  const budgetIncomplete = totalCost !== poolTotal;

  // G2 : PC max
  if (pcDispo > PC_MAX_ETAPE1) {
    erreurs.push(`PC max dépassé : ${pcDispo} > ${PC_MAX_ETAPE1}`);
  }

  // G3 : Bornes par attribut
  const ATTRS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE'];
  for (const attr of ATTRS) {
    const valeur = attributs[attr];
    const base = (attr === 'FOR' && isFeminin) ? 5 : 7;
    if (valeur < base) {
      erreurs.push(`${attr} : ${valeur} < base minimum ${base}`);
    }
    if (valeur > 20) {
      erreurs.push(`${attr} : ${valeur} > 20`);
    }
  }

  // G4 (bonus féminin) supprimée : remise forfaitaire dans calcTotalCost, s'auto-limite à 2,
  // rien à rejeter — voir getFemininBonusDiscount ci-dessus.

  return {
    valide: erreurs.length === 0,
    erreurs,
    budgetIncomplete,
    totalCost,
    poolTotal,
  };
}