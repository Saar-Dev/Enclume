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

import { WOUND_PENALTIES } from '../../../shared/woundConstants.js'
import {
  polarisRound, calcAN, getGenotypeModForAttr, getMutationModForAttr, calcNA,
} from '../../../shared/polarisUtils.js'

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

// ATTR_TO_GENOTYPE_MOD / AN_TABLE importées depuis shared/polarisUtils.js (source unique).

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
// Utilisée par calcDroneRD (ci-dessous) : drones utilisent integrite × 2 comme entrée directe.
export const RD_TABLE = [
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

// §7.6 — Drone : integrite × 2 → table RD. Sain (haute intégrité) → rd négatif → plus vulnérable.
// Endommagé (faible intégrité) → rd positif → noyau durci. Plage couverte : integrite 1–20.
export function calcDroneRD(integrite) {
  const rdInput = (integrite ?? 0) * 2
  return lookupTable(RD_TABLE, rdInput, 'rd') ?? 0
}

// §7.6 — Dégâts nets drone : degautsBruts − blindage − RD(intégrité). ≥ 0.
export function calcDroneDegatsNets(droneSheet, degautsBruts) {
  const etqDrone = droneSheet.blindage ?? 0
  const rdDrone  = calcDroneRD(droneSheet.integrite_actuelle)
  return { etqDrone, rdDrone, degatsNets: Math.max(0, degautsBruts - etqDrone - rdDrone) }
}

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

export function lookupTable(table, value, prop) {
  const row = table.find(r => value >= r.min && value <= r.max)
  return row ? row[prop] : null
}

// ─── Calculs attributs ────────────────────────────────────────────────────────
// getGenotypeModForAttr / calcNA / calcAN importées depuis shared/polarisUtils.js —
// source de calcul unique partagée avec le client (docs/PLAN_MUTATION2.md Lot 1).

export function calcAttributeAN(attrs, attrId, genotypeRow, mutationEffectsRow) {
  const attrRow = (attrs || []).find(a => a.attr_id === attrId)
  if (!attrRow) return 0
  const modGen = getGenotypeModForAttr(genotypeRow, attrId)
  const modMut = getMutationModForAttr(mutationEffectsRow, attrId)
  const na = calcNA(attrRow.base_level, attrRow.pc_modifier, modGen, modMut)
  return calcAN(na)
}

export function calcAttributeNA(attrs, attrId, genotypeRow, mutationEffectsRow) {
  const attrRow = (attrs || []).find(a => a.attr_id === attrId)
  if (!attrRow) return 3
  const modGen = getGenotypeModForAttr(genotypeRow, attrId)
  const modMut = getMutationModForAttr(mutationEffectsRow, attrId)
  return calcNA(attrRow.base_level, attrRow.pc_modifier, modGen, modMut)
}

// ─── Calcul compétences ───────────────────────────────────────────────────────

export function calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow, mutationEffectsRow) {
  if (!refSkill) return 0
  if (!refSkill.attr_1) return 0

  const an1 = calcAttributeAN(attrs, refSkill.attr_1, genotypeRow, mutationEffectsRow)
  const an2 = refSkill.attr_2
    ? calcAttributeAN(attrs, refSkill.attr_2, genotypeRow, mutationEffectsRow)
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
// calcREA déménagée vers shared/polarisUtils.js (source de calcul unique partagée avec le client,
// docs/PLAN_MUTATION2.md Lot 2) — les appelants l'importent directement depuis shared/, pas via
// ce fichier (aucun usage interne ici).

export function calcSeuils(for_na, con_na, vol_na) {
  const etourdissement = polarisRound((for_na + con_na + vol_na) / 3)
  return {
    etourdissement,
    inconscience: etourdissement + 10,
  }
}

function calcAllureMoy(val) {
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
  return {
    lente:   moy / 2,
    moyenne: moy,
    rapide:  moy * 2,
    max:     maxMoy * 4,
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

export function calcSouffle(con_na, vol_na, mod_advantage) {
  return polarisRound((con_na + vol_na) / 2) + (mod_advantage ?? 0)
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

/**
 * Malus global blessures — pire blessure toutes localisations confondues.
 * Règle LdB : les autres blessures sont ignorées.
 * @param {Array} wounds — [{ severity, ... }]
 * @returns {number} malus (≤ 0)
 */
export function calcWoundPenalty(wounds) {
  if (!wounds || wounds.length === 0) return 0
  let worst = 0
  for (const w of wounds) {
    const p = WOUND_PENALTIES[w.severity] ?? 0
    if (p < worst) worst = p
  }
  return worst
}

// ─── Encombrement (Chantier 10) ───────────────────────────────────────────────

/**
 * Malus INI encombrement — chaque kg au-dessus du seuil réduit l'initiative de 1.
 * Seuil = FOR nette × multiplier (option de campagne encumbrance_multiplier, défaut 3).
 * Items dans 'Coffre' exclus du calcul. Voir docs/PLAN_MUTATION2.md Lot 1 (option
 * encumbrance_enabled — gérée par l'appelant, pas ici : si désactivée, ne pas appeler cette
 * fonction et utiliser 0 directement).
 * @param {number} totalWeight — poids total porté (kg)
 * @param {number} forValue    — valeur FOR nette (calcAttributeNA — base_level + pc_modifier +
 *                                mod_genotype + mod_mutation)
 * @param {number} [multiplier=3] — settings.encumbrance_multiplier de la campagne
 * @returns {number} malus positif (à soustraire de l'INI)
 */
export function calcEncumbrancePenalty(totalWeight, forValue, multiplier = 3) {
  const threshold = forValue * multiplier
  return Math.max(0, Math.ceil(totalWeight - threshold))
}

// ─── Résistance armure (mille-feuille, LdB p.312) ────────────────────────────

/**
 * Calcule la protection effective par mille-feuille pour un slot donné.
 * @param {Array} equippedItems — items filtrés par slot (ref_protection, ref_protection_shock)
 * @returns {{ etq: number|null, prt: number|null }}
 */
export function calcResistanceArmure(equippedItems) {
  const compute = (field) => {
    const vals = equippedItems.map(i => i[field] ?? 0).filter(v => v > 0)
    if (!vals.length) return null
    const max  = Math.max(...vals)
    const rest = vals.reduce((s, v) => s + v, 0) - max
    return max + polarisRound(rest / 2)
  }
  return { etq: compute('ref_protection'), prt: compute('ref_protection_shock') }
}

// ─── Test de Choc — LdB p.239 ────────────────────────────────────────────────
// is_lethal = dégâts nets >= 30 (blessure mortelle par impact direct — membre détruit)
const MEMBER_LOCATIONS = ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']

export function getShockMalus(severity, location, is_lethal) {
  if (is_lethal && MEMBER_LOCATIONS.includes(location)) return -10
  if (severity === 'grave') return location === 'tete' ? -5 : 0
  if (severity === 'critique') {
    if (location === 'tete')  return -10
    if (location === 'corps') return -5
    return 0
  }
  if (severity === 'mortelle') {
    if (location === 'tete')  return -15
    if (location === 'corps') return -10
    return -5
  }
  return 0
}
