// shared/combatExclusiveActions.js — Tir visé (LdB p.227-228) + framework Actions Exclusives.
// Évaluateur pur, importé identique client (retour UI immédiat) et serveur (rejet autoritaire) —
// pattern shared/careerEligibility.js. Voir docs/PLAN_TIRVISE.md pour l'architecture complète.

export const AIM_MAX_TRANCHES = 5        // bonus max +5 au Test de tir (Tir visé classique)
export const AIM_INI_PER_TRANCHE = -2    // 2 points d'Initiative sacrifiés par tranche (classique)

// Lunette de visée (docs/PLAN_MODING_PHASEB.md Groupe 2) — variante du Tir visé, pas un bonus
// additif. LdB : +1/niveau jusqu'à +10, 1 point d'Initiative par point de bonus (au lieu de 2),
// bonus lunette et bonus Tir visé non cumulatifs (le plus élevé des deux — capturé ci-dessous par
// un simple min() de coût, jamais un choix de "mode" explicite côté joueur).
export const LUNETTE_MAX_NIVEAU = 10
// Plafond LdB par portée ("un personnage ne devrait pas pouvoir utiliser une lunette de niveau
// supérieur à 3 à courte portée, ou supérieur à 5 à moyenne portée") — non applicable en Phase 1
// Déclaration (portee n'est connue qu'en Phase 2 Résolution, confirmedModifiers). Appliqué comme
// clamp du bonus effectivement compté dans resolveAssaultAction, jamais à la Déclaration.
export const LUNETTE_PORTEE_CAP = {
  bout_portant: 0,        // EXTRAPOLÉ — non sourcé LdB, validé comme hypothèse par Saar
  courte:       3,
  moyenne:      5,
  longue:       LUNETTE_MAX_NIVEAU,
  extreme:      LUNETTE_MAX_NIVEAU,
}

// installedMods = lignes char_inventory_mods jointes à ref_equipment (mod_slot, mod_requires_aim,
// bonus, name) pour une arme donnée — même forme que modingService.calcWeaponModBonus (Groupe 1).
// Au plus un item mod_slot='optique' + mod_requires_aim=true actif (exclusivité garantie à
// l'installation) : jamais de "grouper puis prendre le max".
export function getLunetteNiveau(installedMods) {
  const lunette = (installedMods ?? []).find(m => m.mod_slot === 'optique' && m.mod_requires_aim)
  if (!lunette || lunette.bonus == null) return 0
  const value = Number(lunette.bonus)
  return Number.isInteger(value) ? value : 0
}

// Écrête `points` au plafond global atteignable (5 en classique, ou plus haut si une lunette de
// niveau supérieur est installée — jamais moins que 5, la Lunette ne réduit jamais le Tir visé de
// base) puis retient le coût le moins cher entre les deux systèmes pour ce nombre de points écrêté.
// Toujours un coût fini après écrêtage — jamais de cas Infinity à gérer côté appelant (contrairement
// à une version antérieure de ce fichier qui renvoyait 0 au lieu d'écrêter, bug corrigé avant tout
// test réel).
function resolveAimPoints(aimTranches, lunetteNiveau) {
  const overallCap = Math.max(AIM_MAX_TRANCHES, lunetteNiveau)
  const points = Math.max(0, Math.min(Math.floor(aimTranches ?? 0), overallCap))
  const classicCost = points > AIM_MAX_TRANCHES ? Infinity : points * -AIM_INI_PER_TRANCHE
  const lunetteCost = points > lunetteNiveau ? Infinity : points
  return { points, cost: Math.min(classicCost, lunetteCost) }
}

// Bonus au Test de tir pour N tranches choisies (Phase 1 Déclaration — stocké tel quel sur
// combat_actions.aim_bonus_comp, jamais confiance au client). `lunetteNiveau` : niveau de la
// Lunette installée sur l'arme utilisée (0 si aucune) — re-dérivé serveur via getLunetteNiveau,
// jamais transmis par le client. Aucune dépendance à `portee` ici (voir LUNETTE_PORTEE_CAP).
export function getAimBonusComp(aimTranches, { lunetteNiveau = 0 } = {}) {
  return resolveAimPoints(aimTranches, lunetteNiveau).points
}

// Coût INI correspondant (toujours négatif ou nul) — en miroir de getAimBonusComp, même contexte.
export function getAimIniCost(aimTranches, { lunetteNiveau = 0 } = {}) {
  return -resolveAimPoints(aimTranches, lunetteNiveau).cost
}

// Phase 2 Résolution (resolveAssaultAction) — clamp du bonus stocké à Déclaration selon la portée
// désormais connue (confirmedModifiers.portee). Le Tir visé classique n'a aucune restriction de
// portée (LdB, non plafonné ici) ; seule la Lunette a un plafond par portée — capturé en prenant le
// max entre le plafond classique (5, toujours atteignable) et le plafond lunette à cette portée.
export function getEffectiveAimBonus(aimBonusComp, { lunetteNiveau = 0, portee = null } = {}) {
  const lunetteCapAtPortee = Math.min(lunetteNiveau, LUNETTE_PORTEE_CAP[portee] ?? 0)
  const cap = Math.max(AIM_MAX_TRANCHES, lunetteCapAtPortee)
  return Math.min(aimBonusComp ?? 0, cap)
}

// Tir visé éligible : "tu ne vises que si tu ne fais que ça" (règle Saar, PLAN_TIRVISE.md
// Décision 9). Position, arme, mode de tir, couverture et vitesse sont tous des états au même
// titre (state_* sur combat_roster) — dégainer son arme ou changer de mode de tir est une
// transition tout autant qu'un déplacement, et "viser ET faire autre chose" n'est pas cohérent.
// Règle unique : aucune transition d'état ce tour + aucune autre mapAction/quick action.
// `entry` = ligne combat_roster AVANT cette déclaration (état persisté, jamais reconstruit depuis
// le payload client).
//
// Implémentation en une seule fonction (getAimIneligibilityReasons), source unique de vérité :
// isAimEligible (utilisé serveur, juste besoin d'un pass/fail) en dérive directement — évite de
// dupliquer les conditions entre un booléen et une liste de raisons.

// Retourne la liste des raisons d'inéligibilité (vide = éligible). Raisons en français direct,
// pas de clé i18n — le domaine Combat est explicitement hors périmètre i18n dans ce projet
// (.claude/rules/react.md : "Combat (12) + équipement (6) : hors scope — sprint dédié futur"),
// cohérent avec les tooltips combat existants déjà en dur (ex. "Assommé — ne peut pas attaquer").
export function getAimIneligibilityReasons({ mapActions, state, quick, entry, isDualWield, bulletCount }) {
  const reasons = []
  if (bulletCount !== 1) reasons.push('tir non simple (répétition ou rafale)')
  if (isDualWield) reasons.push('deux armes')
  // Préconditions intrinsèques : arme déjà au clair + déjà en coup par coup AVANT ce tour.
  if (entry?.state_weapon !== 'drawn') reasons.push('arme pas encore au clair')
  if (entry?.state_fire_mode !== 'cc') reasons.push('pas encore en coup par coup')
  // Aucune transition d'état ce tour, sur aucun état.
  if (state?.position !== entry?.state_position) reasons.push('changement de posture')
  if (state?.weapon !== entry?.state_weapon) reasons.push('changement d\'arme')
  if (state?.fire_mode !== entry?.state_fire_mode) reasons.push('changement de mode de tir')
  if (state?.cover !== entry?.state_cover) reasons.push('changement de couverture')
  if (state?.vitesse !== entry?.state_vitesse) reasons.push('changement de vitesse')
  // Aucune autre mapAction / quick action ce tour.
  if (mapActions?.move) reasons.push('déplacement')
  if (mapActions?.interact) reasons.push('interaction')
  if (mapActions?.reload) reasons.push('rechargement')
  if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) reasons.push('corps à corps')
  if ((quick?.observer ?? 0) > 0) reasons.push('observation')
  if ((quick?.reperer ?? 0) > 0) reasons.push('repérage')
  if (quick?.phrase) reasons.push('phrase prononcée')
  return reasons
}

export function isAimEligible(args) {
  return getAimIneligibilityReasons(args).length === 0
}

// Déclaration exclusive ? (registre — Charge/Rafale longue/Tir de suppression rejoindront cette
// fonction dans leurs propres sessions dédiées, pas ici). Pour Tir visé, isAimEligible bloque déjà
// le CaC (règle "rien d'autre ce tour") — ce garde reste la seule protection pour les futures
// actions exclusives dont l'éligibilité sera plus permissive (ex. Charge exige un déplacement).
export function isExclusiveDeclaration({ mapActions }) {
  if ((mapActions?.attack?.aimTranches ?? 0) > 0) return { exclusive: true, reason: 'tir_vise' }
  return { exclusive: false, reason: null }
}
