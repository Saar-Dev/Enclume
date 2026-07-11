// shared/combatExclusiveActions.js — Tir visé (LdB p.227-228) + framework Actions Exclusives.
// Évaluateur pur, importé identique client (retour UI immédiat) et serveur (rejet autoritaire) —
// pattern shared/careerEligibility.js. Voir docs/PLAN_TIRVISE.md pour l'architecture complète.

export const AIM_MAX_TRANCHES = 5        // bonus max +5 au Test de tir
export const AIM_INI_PER_TRANCHE = -2    // 2 points d'Initiative sacrifiés par tranche

// Bonus au Test de tir pour N tranches choisies (clampé 0-5, jamais confiance au client).
export function getAimBonusComp(aimTranches) {
  return Math.max(0, Math.min(AIM_MAX_TRANCHES, Math.floor(aimTranches ?? 0)))
}

// Coût INI correspondant (toujours négatif ou nul).
export function getAimIniCost(aimTranches) {
  return getAimBonusComp(aimTranches) * AIM_INI_PER_TRANCHE
}

// Tir visé éligible : "tu ne vises que si tu ne fais que ça" (règle Saar, PLAN_TIRVISE.md
// Décision 9). Position, arme, mode de tir, couverture et vitesse sont tous des états au même
// titre (state_* sur combat_roster) — dégainer son arme ou changer de mode de tir est une
// transition tout autant qu'un déplacement, et "viser ET faire autre chose" n'est pas cohérent.
// Règle unique : aucune transition d'état ce tour + aucune autre mapAction/quick action.
// `entry` = ligne combat_roster AVANT cette déclaration (état persisté, jamais reconstruit depuis
// le payload client).
export function isAimEligible({ mapActions, state, quick, entry, isDualWield, bulletCount }) {
  if (bulletCount !== 1) return false
  if (isDualWield) return false
  // Préconditions intrinsèques : arme déjà au clair + déjà en coup par coup AVANT ce tour.
  if (entry?.state_weapon !== 'drawn') return false
  if (entry?.state_fire_mode !== 'cc') return false
  // Aucune transition d'état ce tour, sur aucun état.
  if (state?.position !== entry?.state_position) return false
  if (state?.weapon !== entry?.state_weapon) return false
  if (state?.fire_mode !== entry?.state_fire_mode) return false
  if (state?.cover !== entry?.state_cover) return false
  if (state?.vitesse !== entry?.state_vitesse) return false
  // Aucune autre mapAction / quick action ce tour.
  if (mapActions?.move) return false
  if (mapActions?.interact) return false
  if (mapActions?.reload) return false
  if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) return false
  if ((quick?.observer ?? 0) > 0 || (quick?.reperer ?? 0) > 0 || quick?.phrase) return false
  return true
}

// Déclaration exclusive ? (registre — Charge/Rafale longue/Tir de suppression rejoindront cette
// fonction dans leurs propres sessions dédiées, pas ici). Pour Tir visé, isAimEligible bloque déjà
// le CaC (règle "rien d'autre ce tour") — ce garde reste la seule protection pour les futures
// actions exclusives dont l'éligibilité sera plus permissive (ex. Charge exige un déplacement).
export function isExclusiveDeclaration({ mapActions }) {
  if ((mapActions?.attack?.aimTranches ?? 0) > 0) return { exclusive: true, reason: 'tir_vise' }
  return { exclusive: false, reason: null }
}
