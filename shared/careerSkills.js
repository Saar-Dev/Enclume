// careerSkills.js — Moteur de coût pur pour l'allocation globale des compétences (Wizard Step 4).
// Réutilise shared/polarisUtils.js (calcSkillCost, getMaxMasteryByYears), jamais recréé.
//
// FONCTION PURE : aucun accès base. L'appelant fournit ctx déjà résolu (années par carrière,
// compétences listées par carrière, compétences des études supérieures, maîtrise de base issue
// des origines, catalogue refSkills pour les markers (X)/PN).
//
// Plafond (REGLE_CREATION.txt:1250-1263, marqué "(OPTIONNEL)" — option skill_max_level, défaut
// OFF) : compétence professionnelle (listée par ≥1 carrière retenue, ou par les études supérieures
// qui comptent pour +2 ans comme une profession) → getMaxMasteryByYears(Σ années + 2 si études) si
// ctx.skillMaxLevelEnabled, sinon Infinity (seul le budget Q2 limite). Compétence d'origine
// (géo/social/formation) qui n'est PAS professionnelle → plafond fixe +5 (REGLE_CREATION.txt:
// 1122-1128, règle de base non optionnelle), pas la table par années.
// Coût ×2 "hors profession" (REGLE_CREATION.txt:1117-1121) : basé uniquement sur l'appartenance
// à une carrière retenue — les études supérieures ne comptent PAS pour le coût, seulement pour
// le plafond.

import { calcSkillCost, getMaxMasteryByYears } from './polarisUtils.js'

const ORIGIN_SKILL_CAP = 5

function isProSkill(skillId, careers) {
  return careers.some(c => (c.skills || []).includes(skillId))
}

/**
 * Plafond de maîtrise d'une compétence — indépendant du coût, calculable pour toute
 * compétence du board (touchée ou non par le joueur).
 * @param {string} skillId
 * @param {object} ctx - { careers:[{skills,years}], higherEdSkills:[skill_id] }
 */
export function getSkillCap(skillId, ctx) {
  const careers = ctx.careers || []
  const higherEdSkills = ctx.higherEdSkills || []
  const hasHigherEd = higherEdSkills.includes(skillId)
  if (!isProSkill(skillId, careers) && !hasHigherEd) return ORIGIN_SKILL_CAP
  // OPT-08 (skill_max_level, défaut OFF) : plafond par années explicitement marqué
  // "(OPTIONNEL)" par REGLE_CREATION.txt:1250-1263 — désactivé, une compétence pro/études
  // supérieures n'a d'autre limite que le budget (Q2).
  if (!ctx.skillMaxLevelEnabled) return Infinity
  const yearsForSkill = careers
    .filter(c => (c.skills || []).includes(skillId))
    .reduce((sum, c) => sum + c.years, 0)
  return getMaxMasteryByYears(yearsForSkill + (hasHigherEd ? 2 : 0))
}

/**
 * @param {object} skillAllocations - { skill_id: targetMastery } — GLOBAL, compétences
 *   RÉELLEMENT touchées par le joueur uniquement (pas un remplissage de toutes les compétences
 *   du board : une compétence non modifiée doit coûter 0, jamais être soumise à calcSkillCost).
 * @param {object} ctx - {
 *   careers: [{ skills:[skill_id], years }],
 *   higherEdSkills: [skill_id],
 *   baseMastery: { skill_id: number },
 *   refSkills: object[],
 *   openedSkills?: [skill_id],   // compétences réservées (X) déjà ouvertes explicitement (Lot 5)
 *   extraBudgetDelta?: number,   // ajustement ponctuel (ex. Revers Renvoi, "5 points de compétence
 *                                // seulement" pour l'année du Revers = delta -5 sur le taux normal
 *                                // de 10/an, PLAN_WIZARD_AVANTAGES.md §17) — défaut 0, jamais un
 *                                // nouveau système de suivi par année, juste un delta character-wide
 * }
 * @returns {{ budget, totalCost, remaining, perSkill: object[], errors: object[] }}
 */
export function computeSkillAllocation(skillAllocations, ctx) {
  const careers = ctx.careers || []
  const baseMastery = ctx.baseMastery || {}
  const openedSkills = ctx.openedSkills || []
  const refSkills = ctx.refSkills || []

  const budget = careers.reduce((sum, c) => sum + 10 * c.years, 0) + (ctx.extraBudgetDelta ?? 0)

  const perSkill = []
  const errors = []
  let totalCost = 0

  for (const [skillId, target] of Object.entries(skillAllocations || {})) {
    const current = baseMastery[skillId] ?? null
    const isPro = isProSkill(skillId, careers)
    const cap = getSkillCap(skillId, ctx)

    const capped = target > cap
    if (capped) errors.push({ code: 'over_cap', skillId, target, cap })

    // Une compétence (X) est déjà "ouverte" si : listée par une carrière retenue
    // (REGLE_CREATION.txt:1129-1132 — "inaccessibles... à moins d'être indiquées dans la
    // description de l'une des Professions"), OU dotée d'un bonus d'origine positif (l'origine
    // l'a déjà entraînée), OU explicitement débloquée (Lot 5, Avantage Formation).
    const isLearned = isPro || openedSkills.includes(skillId) || (baseMastery[skillId] ?? 0) > 0
    const { cost } = calcSkillCost(skillId, current, target, isPro, isLearned, refSkills)
    totalCost += cost
    perSkill.push({ skillId, current, target, isPro, cost, cap, capped })
  }

  const remaining = budget - totalCost
  if (totalCost > budget) errors.push({ code: 'over_budget', totalCost, budget })

  return { budget, totalCost, remaining, perSkill, errors }
}

/**
 * Valide l'exclusivité des groupes de choix "au choix" (Lot 5, ref_career_skills.choice_group).
 * Une carrière ne peut retenir qu'UN seul skill_id par choice_group (radio, pas checkbox multiple).
 * Les lignes conditional=true sans choice_group (T1, case à cocher isolée) n'ont aucune contrainte
 * d'exclusivité et sont ignorées ici.
 * @param {string[]} openedSkillIds - compétences "au choix" retenues par le joueur (step4.openedSkills)
 * @param {object[]} careerSkillRows - lignes ref_career_skills conditional=true d'UNE carrière
 *   (career_id implicite : l'appelant scope déjà les rows par métier)
 * @returns {{ errors: [{code:'multiple_choice', choiceGroup, skillIds}] }}
 */
export function validateChoiceGroups(openedSkillIds, careerSkillRows) {
  const opened = new Set(openedSkillIds || [])
  const byGroup = {}
  for (const row of careerSkillRows || []) {
    if (!row.choice_group) continue
    ;(byGroup[row.choice_group] ??= []).push(row.skill_id)
  }

  const errors = []
  for (const [choiceGroup, skillIds] of Object.entries(byGroup)) {
    const chosen = skillIds.filter(id => opened.has(id))
    if (chosen.length > 1) errors.push({ code: 'multiple_choice', choiceGroup, skillIds: chosen })
  }
  return { errors }
}
