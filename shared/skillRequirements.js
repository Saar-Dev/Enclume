// shared/skillRequirements.js
// Évaluateur générique de prérequis de compétence (ref_skill_requirements) — pattern identique à
// shared/naturalWeapons.js / shared/combatExclusiveActions.js : une seule fonction pure, importée
// telle quelle côté client (SkillsPanel.jsx) et serveur (POST /skills/buy), aucune logique dupliquée.
//
// Sémantique : ET entre les lignes non groupées et entre les groupes ; OU entre les lignes qui
// partagent le même or_group (une seule suffit). or_group === null/undefined → ligne isolée, ET.
// Convention or_group identique à ref_career_skills.choice_group (migration 121).
//
// docs/PLAN_MUTATION2.md Lot 5 — HYBRIDE est la seule compétence (sur 232) ayant besoin d'un OU ;
// recherche externe (5etools feat prerequisites — tableau=ET, tableau imbriqué=OU ; PF2e Predicate —
// arbre récursif, pensé pour du contenu homebrew, hors scope ici) confirme qu'un modèle à 2 niveaux
// (ET entre groupes, OU dans un groupe) est le bon dimensionnement, pas un arbre booléen généraliste.

export function areRequirementsSatisfied(requirements, isReqSatisfied) {
  if (!requirements || requirements.length === 0) return true

  const grouped = new Map()
  const ungrouped = []
  for (const req of requirements) {
    if (req.or_group) {
      if (!grouped.has(req.or_group)) grouped.set(req.or_group, [])
      grouped.get(req.or_group).push(req)
    } else {
      ungrouped.push(req)
    }
  }

  for (const req of ungrouped) {
    if (!isReqSatisfied(req)) return false
  }
  for (const group of grouped.values()) {
    if (!group.some(isReqSatisfied)) return false
  }
  return true
}
