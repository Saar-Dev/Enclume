/**
 * charStats.js — Bibliothèque de calcul des statistiques personnage
 *
 * Fonctions PURES — aucun accès DB. Toutes les données sont passées en paramètre.
 * Le caller (socket/index.js ou toute route) est responsable des requêtes DB.
 *
 * Source de vérité mécanique côté serveur pour toutes les résolutions de jets.
 * Le client calcule indépendamment pour l'affichage UI — ces deux calculs doivent
 * produire les mêmes résultats.
 *
 * Références : Livre de Base Polaris (LdB)
 */

// ─── Constante V1 ─────────────────────────────────────────────────────────────
// TOTAL_MALUS = 0 en V1 — le système d'historique XP n'est pas implémenté.
// PC2 : toujours passer cette constante explicitement dans calcNA.
const TOTAL_MALUS = 0

// ─── Labels complets des attributs (LdB p.112-113) ───────────────────────────
// Utilisés pour l'affichage dans le chat (jets de dés, résultats interactions).
// Textes issus du Livre de Base — ne jamais modifier sans vérification LdB.
export const ATTR_LABELS = {
  FOR: 'Force',
  CON: 'Constitution',
  COO: 'Coordination',
  ADA: 'Adaptation',
  PER: 'Perception',
  INT: 'Intelligence',
  VOL: 'Volonté',
  PRE: 'Présence',
}

// Descriptions complètes — pour tooltips futurs (LdB p.112-113)
export const ATTR_DESCRIPTIONS = {
  FOR: "La Force (FOR) est une mesure de la puissance brute d'un individu, sa capacité musculaire.",
  CON: "La Constitution (CON) caractérise l'endurance d'un individu, sa santé, sa résistance à l'effort physique, aux poisons, aux maladies, aux traumatismes, aux conditions extrêmes.",
  COO: "La Coordination (COO) détermine la coordination neuromusculaire du personnage, mais aussi plus largement son agilité physique, son sens de l'équilibre, la fluidité et la précision de ses gestes, de ses mouvements et de ses déplacements.",
  ADA: "L'Adaptation (ADA) représente la capacité du personnage à s'adapter à son environnement, et notamment à une situation qui change brutalement, les réflexes issus de son instinct de survie et la rapidité de sa réflexion.",
  PER: "La Perception (PER) détermine l'acuité des cinq sens du personnage, mais aussi sa vigilance, l'attention qu'il porte à son environnement ou au comportement des gens, sa capacité à remarquer les petits détails du monde qui l'entoure.",
  INT: "L'Intelligence (INT) mesure les capacités mentales d'un individu. C'est aussi sa faculté d'assimilation de nouvelles connaissances.",
  VOL: "La Volonté (VOL) détermine la résistance mentale d'une personne, sa capacité à maîtriser ses réactions en situation de stress et le temps pendant lequel elle peut maintenir sa concentration sur une action quelconque.",
  PRE: "La Présence (PRE) est une mesure de l'aura dégagée par une personne, de son charisme.",
}

// ─── Mapping attr_id → colonne mod_* dans ref_genotypes ──────────────────────
// Permet de lire le modificateur génotype pour un attribut donné.
const ATTR_TO_GENOTYPE_MOD = {
  FOR: 'mod_for',
  CON: 'mod_con',
  COO: 'mod_coo',
  ADA: 'mod_ada',
  PER: 'mod_per',
  INT: 'mod_int',
  VOL: 'mod_vol',
  PRE: 'mod_pre',
}

// ─── Table Aptitude Naturelle (LdB p.114) ────────────────────────────────────
const AN_TABLE = [
  { min: -Infinity, max: 2,  an: -4 },
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

// ─── Table Modificateur de Dommages — corps à corps (LdB p.113) ──────────────
const MOD_DOM_TABLE = [
  { min: 1,  max: 2,  mod: -6 },
  { min: 3,  max: 4,  mod: -4 },
  { min: 5,  max: 6,  mod: -2 },
  { min: 7,  max: 8,  mod: -1 },
  { min: 9,  max: 11, mod:  0 },
  { min: 12, max: 13, mod: +1 },
  { min: 14, max: 15, mod: +2 },
  { min: 16, max: 17, mod: +3 },
  { min: 18, max: 19, mod: +4 },
  { min: 20, max: 21, mod: +5 },
]

// ─── Table Résistance aux Dommages — FOR+CON (LdB p.114) ─────────────────────
const RD_TABLE = [
  { min: 2,  max: 5,  rd: +6 },
  { min: 6,  max: 9,  rd: +4 },
  { min: 10, max: 13, rd: +2 },
  { min: 14, max: 17, rd: +1 },
  { min: 18, max: 21, rd:  0 },
  { min: 22, max: 25, rd: -1 },
  { min: 26, max: 29, rd: -2 },
  { min: 30, max: 33, rd: -3 },
  { min: 34, max: 37, rd: -4 },
  { min: 38, max: 41, rd: -5 },
]

// ─── Table Résistance Naturelle (LdB p.114) ──────────────────────────────────
const RES_NAT_TABLE = [
  { min: 1,  max: 2,  res: +6 },
  { min: 3,  max: 4,  res: +4 },
  { min: 5,  max: 6,  res: +2 },
  { min: 7,  max: 8,  res: +1 },
  { min: 9,  max: 11, res:  0 },
  { min: 12, max: 13, res: -1 },
  { min: 14, max: 15, res: -2 },
  { min: 16, max: 17, res: -3 },
  { min: 18, max: 19, res: -4 },
  { min: 20, max: 21, res: -5 },
]

// ─── Table des modificateurs de difficulté (LdB p.404) ───────────────────────
export const DIFFICULTY_MOD_TABLE = [
  { label: 'Extrêmement facile', mod: +10 },
  { label: 'Très facile',        mod:  +7 },
  { label: 'Facile',             mod:  +5 },
  { label: 'Assez facile',       mod:  +3 },
  { label: 'Moyen',              mod:   0 },
  { label: 'Assez difficile',    mod:  -3 },
  { label: 'Difficile',          mod:  -5 },
  { label: 'Très difficile',     mod:  -7 },
  { label: 'Extrêmement difficile', mod: -10 },
  { label: 'Presque impossible', mod: -13 },
  { label: 'Surhumain',          mod: -15 },
  { label: 'Héroïque',           mod: -20 },
]

// ─── Tables qualitatives (LdB p.113, p.115) ──────────────────────────────────

export const ATTR_LEVEL_LABELS = [
  { min: 1,  max: 2,  label: 'Insignifiant' },
  { min: 3,  max: 5,  label: 'Très faible' },
  { min: 6,  max: 8,  label: 'Faible' },
  { min: 9,  max: 12, label: 'Moyen' },
  { min: 13, max: 15, label: 'Fort' },
  { min: 16, max: 18, label: 'Très fort' },
  { min: 19, max: 20, label: 'Exceptionnel' },
  { min: 21, max: Infinity, label: 'Surhumain' },
]

export const MASTERY_LEVEL_LABELS = [
  { min: 0,  max: 0,  label: 'Inexpérimenté' },
  { min: 1,  max: 5,  label: 'Débutant' },
  { min: 6,  max: 10, label: 'Confirmé, expert' },
  { min: 11, max: 15, label: 'Maître' },
]

export const SKILL_LEVEL_LABELS = [
  { min: -Infinity, max: 0,  label: 'Aucune connaissance' },
  { min: 1,  max: 5,  label: 'Connaissances de base' },
  { min: 6,  max: 10, label: 'Connaissances moyennes' },
  { min: 11, max: 15, label: 'Connaissances approfondies' },
  { min: 16, max: 20, label: 'Érudition ou maîtrise exceptionnelle' },
  { min: 21, max: Infinity, label: 'Génie' },
]

// ─── Utilitaires internes ─────────────────────────────────────────────────────

function lookupTable(table, value, prop) {
  const row = table.find(r => value >= r.min && value <= r.max)
  return row ? row[prop] : null
}

/**
 * Arrondi Polaris : Math.floor(x + 0.4)
 * 0.5 arrondit vers le bas — différent de Math.round. (PC3)
 */
export function polarisRound(x) {
  return Math.floor(x + 0.4)
}

// ─── Calculs attributs ────────────────────────────────────────────────────────

export function getGenotypeModForAttr(genotypeRow, attrId) {
  if (!genotypeRow) return 0
  const col = ATTR_TO_GENOTYPE_MOD[attrId]
  if (!col) return 0
  return genotypeRow[col] ?? 0
}

export function calcNA(base_level, pc_modifier, mod_genotype) {
  const raw = (base_level ?? 7) + (pc_modifier ?? 0) + (mod_genotype ?? 0) - TOTAL_MALUS
  return Math.max(3, raw)
}

export function calcAN(na) {
  const result = lookupTable(AN_TABLE, na, 'an')
  return result ?? 0
}

export function calcAttributeAN(attrs, attrId, genotypeRow) {
  const attrRow = (attrs || []).find(a => a.attr_id === attrId)
  if (!attrRow) return 0
  const modGen = getGenotypeModForAttr(genotypeRow, attrId)
  const na = calcNA(attrRow.base_level, attrRow.pc_modifier, modGen)
  return calcAN(na)
}

export function calcAttributeNA(attrs, attrId, genotypeRow) {
  const attrRow = (attrs || []).find(a => a.attr_id === attrId)
  if (!attrRow) return 3
  const modGen = getGenotypeModForAttr(genotypeRow, attrId)
  return calcNA(attrRow.base_level, attrRow.pc_modifier, modGen)
}

// ─── Calcul compétences ───────────────────────────────────────────────────────

export function calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow) {
  if (!refSkill) return 0
  if (!refSkill.attr_1) return 0

  const an1 = calcAttributeAN(attrs, refSkill.attr_1, genotypeRow)
  const an2 = refSkill.attr_2
    ? calcAttributeAN(attrs, refSkill.attr_2, genotypeRow)
    : an1

  const base = an1 + an2
  const mastery = charSkillRow?.mastery ?? 0
  return base + mastery
}

// ─── Modificateur de Dommages ─────────────────────────────────────────────────

export function getModDom(for_na) {
  if (for_na > 21) {
    return 5 + Math.floor((for_na - 21) / 2)
  }
  const result = lookupTable(MOD_DOM_TABLE, for_na, 'mod')
  return result ?? 0
}

// ─── Attributs secondaires ────────────────────────────────────────────────────

export function calcREA(ada_na, per_na) {
  return polarisRound((ada_na + per_na) / 2)
}

export function calcSeuils(for_na, con_na, vol_na) {
  const etourdissement = polarisRound((for_na + con_na + vol_na) / 3)
  return {
    etourdissement,
    inconscience: etourdissement + 10,
  }
}

export function calcVitesses(for_na, coo_na, ada_na) {
  const marche = polarisRound((for_na + coo_na + ada_na) / 3)
  return {
    marche,
    course: marche * 2,
  }
}

export function calcResistanceDommages(for_na, con_na) {
  const sum = for_na + con_na
  if (sum > 41) {
    return -5 - Math.floor((sum - 41) / 4)
  }
  const result = lookupTable(RD_TABLE, sum, 'rd')
  return result ?? 0
}

export function calcResistanceNaturelle(result_na) {
  if (result_na > 21) {
    return -5 - Math.floor((result_na - 21) / 2)
  }
  const result = lookupTable(RES_NAT_TABLE, result_na, 'res')
  return result ?? 0
}

export function calcResistanceDroguesInput(con_na, vol_na) {
  return polarisRound((con_na + vol_na) / 2)
}

export function calcSouffle(con_na, vol_na) {
  return polarisRound((con_na + vol_na) / 2)
}

// ─── Coût XP — dépense de compétences (LdB) ──────────────────────────────────
// Utilisé par la route POST /api/char-sheet/:characterId/skills/buy.
// Le client dispose d'un miroir identique pour l'affichage uniquement —
// le serveur recalcule indépendamment et est source de vérité.

/**
 * Retourne le coût en PE pour augmenter une compétence d'un niveau.
 * @param {number} currentMastery — maîtrise actuelle (avant augmentation)
 * @returns {number} coût en PE
 */
export function getCoutAugmentation(currentMastery) {
  const target = Number(currentMastery) + 1
  if (target <= 5)   return 1
  if (target <= 10)  return 2
  if (target === 11) return 3
  if (target === 12) return 5
  if (target === 13) return 7
  if (target === 14) return 9
  if (target === 15) return 11
  return 11  // au-delà de 15 : non défini LdB, retourne dernier palier
}

/**
 * Retourne le coût fixe de déblocage d'une compétence (X).
 * Correspond aux 3 niveaux -3→0 (3 × 1 PE). mastery reste 0 (PC11).
 * @returns {number} 3 PE
 */
export function getCoutDeblocageX() {
  return 3
}

/**
 * Retourne le coût total pour passer de `from` à `to` niveaux de maîtrise.
 * @param {number} from — maîtrise de départ (non payée)
 * @param {number} to   — maîtrise cible (payée)
 * @returns {number} coût total en PE
 */
export function getCoutTotal(from, to) {
  let total = 0
  for (let i = Number(from); i < Number(to); i++) {
    total += getCoutAugmentation(i)
  }
  return total
}
