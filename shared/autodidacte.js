// autodidacte.js — Formation "Autodidacte" (Wizard Step 4), REGLE_CREATION.txt:1026-1033.
// 7 points libres à répartir, +2 max/compétence, hors compétences (X) et hors compétences à
// prérequis SKILL_MIN (†) — exclusion plus stricte que la lettre de la règle (choix explicite
// Saar : la validation MJ des (X) n'a pas d'équivalent outillé dans le Wizard).
//
// FONCTION PURE : aucun accès base. L'appelant (client via refSkills catalogué, serveur via
// requêtes ref_skills/ref_skill_requirements) fournit une liste de compétences déjà résolue.

export const AUTODIDACTE_TOTAL_POINTS = 7
export const AUTODIDACTE_MAX_PER_SKILL = 2

/**
 * @param {object} skill - { is_category, marker, requirements?: [{type}] }
 */
export function isAutodidacteEligible(skill) {
  return !skill.is_category
    && skill.marker !== '(X)'
    && !(skill.requirements || []).some(r => r.type === 'SKILL_MIN')
}

export function getAutodidacteEligibleIds(refSkills) {
  return (refSkills || []).filter(isAutodidacteEligible).map(s => s.id)
}

/**
 * @param {object} allocations - { skill_id: points } — points attendus dans [1, AUTODIDACTE_MAX_PER_SKILL]
 * @param {string[]} eligibleSkillIds
 * @returns {{ errors: [{code:'not_eligible'|'over_cap'|'over_budget', skillId?, points?, total?}], total }}
 */
export function validateAutodidacteAllocations(allocations, eligibleSkillIds) {
  const eligible = new Set(eligibleSkillIds || [])
  const errors = []
  let total = 0

  for (const [skillId, points] of Object.entries(allocations || {})) {
    // Entrée à 0/négative/non entière : artefact bénin, ignoré plutôt que rejeté (jamais produit
    // par l'UI normale — handleDec supprime la clé au lieu de la mettre à 0).
    if (!Number.isInteger(points) || points <= 0) continue

    if (!eligible.has(skillId)) {
      errors.push({ code: 'not_eligible', skillId })
      continue
    }
    if (points > AUTODIDACTE_MAX_PER_SKILL) {
      errors.push({ code: 'over_cap', skillId, points })
      continue
    }
    total += points
  }

  if (total > AUTODIDACTE_TOTAL_POINTS) errors.push({ code: 'over_budget', total })

  return { errors, total }
}
