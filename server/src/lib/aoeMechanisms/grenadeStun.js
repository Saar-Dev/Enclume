// server/src/lib/aoeMechanisms/grenadeStun.js
//
// Mécanisme AOE « grenade_stun » (grenade assommante) — Segment 3-bis, reprise 1 (PLAN_GRENADES.md §6,
// « grenade_stun → grenade_flashbang → grenade_concussion → grenade_sonic »). RAW (REGLES_ARMES_
// SPECIALES.md § « Grenades — catalogue » + « Grenade assommante ») : « propulse des petites sphères
// de caoutchouc, pour assommer une cible sur 5 mètres de diamètre. » Catalogue : `damage_h '1D6'`,
// `shock '2D10'`.
//
// SÉMANTIQUE : champ UNIFORME dans un rayon fixe — PAS de dégression par palier (contrairement à
// `grenade_frag`), 1 Localisation. Le dégât physique (1D6) est le jet de la formule d'arme, tel quel —
// EXACTEMENT comme `grenade_energy`. Le Choc (2D10) n'est PAS un hook de ce fichier : il est déjà
// générique au tronc (`socketCombatAoe.js#finalizeAoeResolution`, lit `ref_equipment.shock` +
// `shock_mechanism` + `shock_reduced_by_armor` via `effectiveDamage.choc` ou, si la grenade a été
// consommée avant résolution, via `damageService.fetchEquipmentShockDsl`) — ce mécanisme n'a donc
// besoin d'AUCUN postResolve, exactement comme `grenade_energy`.
//
// Écart RAW : « diamètre de 5 m » → rayon 2,5 m (division Ø→rayon, même lecture que `grenade_energy`,
// JOURNAL8).
//
// Squelette cercle partagé : circleGrenade.js (buildShape, filtre, capacités, no-ops).

import {
  buildCircleShape, filterCircleHitTargets, CIRCLE_GRENADE_FLOW,
  noExtraTargets, noTargetRowModifier, noPostResolve,
} from './circleGrenade.js'

// Repli de rayon pour les fixtures — la migration 389 pose `radiusM: 2.5` sur la ligne catalogue.
const STUN_RADIUS_M = 2.5

function buildShape(ctx) {
  return buildCircleShape(ctx, STUN_RADIUS_M)
}

function filterTargets(ctx, visibilityTargets) {
  return filterCircleHitTargets({
    visibilityTargets,
    origin: ctx.aoeShape.origin,
    amplitudeM: ctx.aoeShape.amplitudeM, // figé par buildShape — une seule source
    metrics: ctx.metrics,
  })
}

// Dégât uniforme = jet de la formule d'arme (1D6), préparé par l'orchestrateur et passé en `baseRaw`.
// Pas de dé de dégression, pas de `mr` (`ctx.rollResult` jamais lu). 1 Localisation, armure normale —
// le Choc (2D10) n'est pas renvoyé ici, il est résolu par le tronc (cf. commentaire de tête).
function computeTargetDamage(ctx, ht, { baseRaw }) {
  return { degautsBruts: baseRaw, locationsCount: 1, armorReductionFactor: 1 }
}

export const grenadeStunMechanism = {
  buildShape,
  filterTargets,
  extraTargets: noExtraTargets,
  targetRowModifier: noTargetRowModifier,
  computeTargetDamage,
  postResolve: noPostResolve,
  ...CIRCLE_GRENADE_FLOW,
}
