// shared/naturalWeapons.js — Arme naturelle (Griffes/Crocs/Corne/Excroissance osseuse rétractable),
// docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Évaluateur pur, importé identique client (retour UI
// immédiat) et serveur (rejet autoritaire) — pattern shared/combatExclusiveActions.js.

// Retourne la liste des raisons d'inéligibilité (vide = éligible). Raisons en français direct,
// pas de clé i18n — le domaine Combat est explicitement hors périmètre i18n dans ce projet
// (.claude/rules/react.md), cohérent avec les tooltips combat existants déjà en dur.
export function getNaturalWeaponIneligibilityReasons({ mutation, targetIsGrappled }) {
  const reasons = []
  if (mutation?.natural_weapon_requires_grapple && !targetIsGrappled) reasons.push('cible non saisie')
  return reasons
}

export function isNaturalWeaponEligible(args) {
  return getNaturalWeaponIneligibilityReasons(args).length === 0
}
