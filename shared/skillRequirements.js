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

const IDENTITY_TYPES = new Set(['MUTATION', 'ADVANTAGE', 'GENOTYPE'])

// ─── Chaîne de prérequis — enfant de catégorie sans prérequis propre ──────────────────────────
// Trouvé 2026-10-04 (CHARSHEET-ADVANTAGE-SKILL-GATE) : les 50 Pouvoirs Polaris (enfants de la
// catégorie POUVOIRS_POLARIS) n'ont aucune ligne ref_skill_requirements à eux — seul le verrou
// SKILL_MIN de la catégorie (→ MAITRISE_DE_LA_FORCE_POLARIS, elle-même gatée par l'Avantage Force
// Polaris) régit leur accès. Sans remonter cette chaîne, chaque enfant paraît librement accessible.
//
// effectiveRequirements : prérequis réels d'une compétence — les siens, ou ceux de son parent
// catégorie si elle n'en a aucun en propre (récursif — une seule génération dans les données
// actuelles, mais général plutôt que spécifique à Polaris).
export function effectiveRequirements(skill, skillsById, visited = new Set()) {
  if (!skill || visited.has(skill.id)) return []
  visited.add(skill.id)
  if (skill.requirements?.length > 0) return skill.requirements
  const parent = skill.parent ? skillsById.get(skill.parent) : null
  return parent?.is_category ? effectiveRequirements(parent, skillsById, visited) : []
}

// gatherChainIdentityRequirements : rassemble toutes les lignes ADVANTAGE/MUTATION/GENOTYPE
// rencontrées en remontant la chaîne de prérequis effectifs — directement sur la compétence, ou
// via une ligne SKILL_MIN qui pointe vers une compétence elle-même gatée par l'identité (pas son
// simple niveau). Un prérequis SKILL_MIN dont la cible n'a aucun verrou d'identité n'ajoute rien :
// un niveau de compétence atteignable normalement n'est jamais un motif de masquage, seul un
// Avantage/Mutation/Génotype manquant l'est (CHARSHEET-ADVANTAGE-SKILL-GATE, retour Saar 2026-10-04).
export function gatherChainIdentityRequirements(skill, skillsById, visited = new Set(), acc = []) {
  if (!skill || visited.has(skill.id)) return acc
  visited.add(skill.id)
  for (const req of effectiveRequirements(skill, skillsById)) {
    if (IDENTITY_TYPES.has(req.type)) {
      acc.push(req)
    } else if (req.type === 'SKILL_MIN') {
      const target = skillsById.get(req.value)
      if (target) gatherChainIdentityRequirements(target, skillsById, visited, acc)
    }
  }
  return acc
}

// isBlockedByIdentityChain : true si le blocage réel, au bout de la chaîne de prérequis, est un
// Avantage/Mutation/Génotype manquant — jamais un simple niveau de compétence sous le seuil requis.
// C'est cette distinction qui décide si une compétence doit être masquée (identité) ou affichée
// grisée avec son prérequis mis en avant (compétence minimum atteignable).
export function isBlockedByIdentityChain(skill, skillsById, isIdentityReqSatisfied) {
  const chainReqs = gatherChainIdentityRequirements(skill, skillsById)
  return chainReqs.length > 0 && !areRequirementsSatisfied(chainReqs, isIdentityReqSatisfied)
}
