// shared/combatExclusiveActions.js — Tir visé (LdB p.227-228) + framework Actions Exclusives.
// Évaluateur pur, importé identique client (retour UI immédiat) et serveur (rejet autoritaire) —
// pattern shared/careerEligibility.js. Voir docs/PLAN_TIRVISE.md pour l'architecture complète.

import { getAoeMechanic } from './combatAoe.js'

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

// getStateTransitionReasons — autorité unique des 5 axes d'état (state_* sur combat_roster :
// position/arme/mode de tir/couverture/vitesse) pour une action qui exige "aucune transition
// d'état ce Tour" (Tir visé, actions exclusives AOE). Extrait le 2026-09-04 : ces 5 lignes étaient
// recopiées à l'identique dans `getAimIneligibilityReasons` ET `getAoeExclusiveIneligibilityReasons`
// (même risque de dérive silencieuse que `assaultCheck`/`assaultCheckInputs`, déjà corrigé côté
// client ce même jour — docs/PLANS/PLAN_RW_DECLARE_DERIVATION.md).
// Champ absent du payload = "inchangé" (`?? entry.state_*`), jamais une transition fantôme — les
// handleDeclare humanoïdes n'envoient pas `state.cover` (bug "changement de couverture" systématique
// corrigé le 2026-08-28, avant l'extraction de cette fonction).
//
// `weaponFireModes` (bug réel trouvé en session, Saar 2026-09-04) : la comparaison brute
// `state.fire_mode !== entry.state_fire_mode` confondait "le joueur a choisi un autre mode" et "cette
// arme n'a qu'un seul mode, forcé automatiquement dès sa sélection" (ex. lance-flammes, `RL` seul —
// `AssaultRangedPanel` ne propose même pas de sélecteur). `entry.state_fire_mode` vaut `'cc'` par
// défaut (migration `32_combat_roster.js`) : la première utilisation de N'IMPORTE QUELLE arme
// RC/RL-only déclenchait donc systématiquement un faux "changement de mode de tir", sans qu'aucune
// transition n'ait été demandée par le joueur. `weaponFireModes` = `shared/fireModes.js#parseFireModes
// (ref_fire_mode)` de l'arme réellement utilisée — la même autorité déjà employée ailleurs pour
// cette question. `null`/non fourni = comportement historique conservé (strict, jamais une régression
// silencieuse pour un appelant qui n'aurait pas encore été mis à jour) ; un tableau `.length <= 1`
// (aucun choix réel possible) neutralise la raison, un `.length > 1` la laisse détecter un vrai choix.
export function getStateTransitionReasons({ state, entry, weaponFireModes = null }) {
  const reasons = []
  if ((state?.position ?? entry?.state_position) !== entry?.state_position) reasons.push('changement de posture')
  if ((state?.weapon ?? entry?.state_weapon) !== entry?.state_weapon) reasons.push('changement d\'arme')
  const fireModeIsRealChoice = weaponFireModes == null || weaponFireModes.length > 1
  if (fireModeIsRealChoice && (state?.fire_mode ?? entry?.state_fire_mode) !== entry?.state_fire_mode) {
    reasons.push('changement de mode de tir')
  }
  if ((state?.cover ?? entry?.state_cover) !== entry?.state_cover) reasons.push('changement de couverture')
  if ((state?.vitesse ?? entry?.state_vitesse) !== entry?.state_vitesse) reasons.push('changement de vitesse')
  return reasons
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
export function getAimIneligibilityReasons({ mapActions, state, quick, entry, isDualWield, bulletCount, isAoeMode, weaponFireModes }) {
  const reasons = []
  if (bulletCount !== 1) reasons.push('tir non simple (répétition ou rafale)')
  if (isDualWield) reasons.push('deux armes')
  // Tir Multi (docs/PLAN_TIRMULTI.md D10) : une série de plusieurs tirs est par construction
  // « une autre action ce Tour » vis-à-vis de chacun de ses éléments — même exclusivité que le CaC
  // ci-dessous, appliquée au tir lui-même.
  if (Array.isArray(mapActions?.attack) && mapActions.attack.length > 1) reasons.push('tir multiple')
  // Zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9) : une action de zone n'a pas de cible unique,
  // « viser » (au sens Tir visé) n'a pas de sens dessus — même statut que Tir Multi ci-dessus.
  if (isAoeMode) reasons.push('zone d\'effet active')
  // Préconditions intrinsèques : arme déjà au clair + déjà en coup par coup AVANT ce tour.
  if (entry?.state_weapon !== 'drawn') reasons.push('arme pas encore au clair')
  if (entry?.state_fire_mode !== 'cc') reasons.push('pas encore en coup par coup')
  // Aucune transition d'état ce tour, sur aucun état — voir getStateTransitionReasons (autorité
  // unique, partagée avec getAoeExclusiveIneligibilityReasons).
  reasons.push(...getStateTransitionReasons({ state, entry, weaponFireModes }))
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

// Tir Multi (docs/PLAN_TIRMULTI.md D6/D10) — réciproque de getAimIneligibilityReasons : raisons pour
// lesquelles une série de plusieurs tirs (mapActions.attack.length > 1) n'est pas disponible. Même
// patron (liste de raisons, vide = éligible), symétrique côté UI (griser + tooltip, pas de reset
// silencieux d'un autre champ).
export function getMultiShotIneligibilityReasons({ currentFireMode, aimTranches, isDualWield, aimedLocation }) {
  const reasons = []
  // D6 — RAW « Attaques multiples » (p.218-219) ne couvre que Tir simple/Tir à répétition ; Rafale
  // longue est de toute façon une action exclusive, Rafale courte n'est pas couverte par le texte.
  if (currentFireMode !== 'CC') reasons.push('rafale (RC/RL)')
  // D10 — Tir visé, Tir à deux armes et Viser une Localisation précise sont chacun exclusifs vis-à-vis
  // de Tir Multi (tranché Saar, 2026-07-19) : un seul raffinement de tir à la fois.
  if ((aimTranches ?? 0) > 0) reasons.push('tir visé actif')
  if (isDualWield) reasons.push('deux armes actif')
  if (aimedLocation) reasons.push('localisation visée active')
  return reasons
}

export function isMultiShotEligible(args) {
  return getMultiShotIneligibilityReasons(args).length === 0
}

// Déclaration exclusive ? Étendue (docs/PLANS/PLAN_AOE.md §8 étape 7, 2026-08-26) : Tir de
// suppression et Lance-flammes rejoignent le Tir visé — Rafale longue "fusil à pompe" reste hors
// scope (aucune donnée catalogue ne permet d'identifier un fusil à pompe : pas de category dédiée,
// vérifié sur `ref_equipment` réel — fusionnera avec le travail catalogue de PLAN_AOE.md §6.2bis/6c).
// - Tir de suppression n'a pas de marqueur catalogue possible (n'importe quelle arme automatique
//   peut le faire, c'est une intention déclarée, pas une propriété de l'arme) : détecté via
//   `mapActions.attack[0].aoe.mode === 'suppression'`, un champ que le client doit positionner.
// - Lance-flammes est identifié par son `aoe_profile.mechanic === 'flamethrower'` (donnée catalogue,
//   segment 0b — `shared/combatAoe.js`), plus par `ref_name` en dur.
export function isExclusiveDeclaration({ mapActions, weaponAoeProfile = null }) {
  if ((mapActions?.attack?.[0]?.aimTranches ?? 0) > 0) return { exclusive: true, reason: 'tir_vise' }
  const aoe = mapActions?.attack?.[0]?.aoe
  if (aoe?.mode === 'suppression') return { exclusive: true, reason: 'tir_suppression' }
  if (aoe && getAoeMechanic(weaponAoeProfile) === 'flamethrower') {
    return { exclusive: true, reason: 'lance_flammes' }
  }
  return { exclusive: false, reason: null }
}

// Raisons d'inéligibilité pour une action exclusive AOE (Tir de suppression, Lance-flammes) —
// interprétation stricte tranchée par Saar (2026-08-26) : la RAW générale (REGLESYSCOMBAT.md:707-710)
// ne dit littéralement que "n'autorise pas d'autres Attaques", plus étroit que le Tir visé (qui a sa
// propre clause d'immobilité en RAW). Saar a choisi d'aligner quand même sur la sévérité du Tir visé
// déjà codé (getAimIneligibilityReasons), pour la cohérence — décision produit, pas une lecture RAW
// littérale. Même patron (liste de raisons, vide = éligible), sans les préconditions propres au Tir
// visé (bulletCount===1, arme déjà au clair...) qui n'ont pas de fondement RAW pour ces actions-ci.
export function getAoeExclusiveIneligibilityReasons({ mapActions, state, quick, entry, weaponFireModes }) {
  const reasons = []
  if (Array.isArray(mapActions?.attack) && mapActions.attack.length > 1) reasons.push('tir multiple')
  // Aucune transition d'état ce tour, sur aucun état — voir getStateTransitionReasons (autorité
  // unique, partagée avec getAimIneligibilityReasons).
  reasons.push(...getStateTransitionReasons({ state, entry, weaponFireModes }))
  if (mapActions?.move) reasons.push('déplacement')
  if (mapActions?.interact) reasons.push('interaction')
  if (mapActions?.reload) reasons.push('rechargement')
  if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) reasons.push('corps à corps')
  if ((quick?.observer ?? 0) > 0) reasons.push('observation')
  if ((quick?.reperer ?? 0) > 0) reasons.push('repérage')
  if (quick?.phrase) reasons.push('phrase prononcée')
  return reasons
}

export function isAoeExclusiveEligible(args) {
  return getAoeExclusiveIneligibilityReasons(args).length === 0
}

// Tenter de se relever (exo-armure, `state_position` prone → autre, PLAN_EXOARMURE.md Lot 2bis §9.2)
// — exclusif dans tous les cas, réussite ou échec (Saar, 2026-08-18 : "oui, exclusivité de l'action").
// Contrairement à Tir visé (isAimEligible), aucune condition sur l'état COURANT du personnage n'entre
// ici : la transition de position EST l'action elle-même (détectée par l'appelant, pas ce fichier —
// socketCombatAnnouncement.js sait déjà si `character.type === 'exo'` et `entry.state_position ===
// 'prone'`), cette fonction ne vérifie que ce qui est déclaré EN PLUS. Même patron que
// `getAimIneligibilityReasons` (liste de raisons, vide = éligible) — pas de table, un nombre de cas
// trop faible pour la justifier.
export function getExoStandUpIneligibilityReasons({ mapActions, quick }) {
  const reasons = []
  if (mapActions?.move) reasons.push('déplacement')
  if (mapActions?.interact) reasons.push('interaction')
  if (mapActions?.reload) reasons.push('rechargement')
  if (Array.isArray(mapActions?.attack) && mapActions.attack.length > 0) reasons.push('tir')
  if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) reasons.push('corps à corps')
  if ((quick?.observer ?? 0) > 0) reasons.push('observation')
  if ((quick?.reperer ?? 0) > 0) reasons.push('repérage')
  if (quick?.phrase) reasons.push('phrase prononcée')
  return reasons
}

export function isExoStandUpEligible(args) {
  return getExoStandUpIneligibilityReasons(args).length === 0
}
