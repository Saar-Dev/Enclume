// server/src/lib/aoeMechanisms/grenadeEnergy.js
//
// Mécanisme AOE « grenade_energy » (grenade à énergie) — Segment 3-bis, premier type après la
// fragmentation. RAW (REGLES_ARMES_SPECIALES.md § « Grenade sonique et grenade à énergie », desc.
// verbatim du seed catalogue) : « génère un champ d'énergie, limité à un diamètre de 5 m. Rien
// d'autre n'est affecté au-delà de cette zone. » Catalogue : `damage_h "6D10"`, `shock` nul.
//
// SÉMANTIQUE : champ d'énergie UNIFORME dans un rayon fixe — PAS de dégression par palier
// (contrairement à `grenade_frag`), pas de Choc, pas de statut, 1 Localisation. Le dégât par cible
// est le jet de la formule d'arme, tel quel.
//
// Écarts RAW (JOURNAL8, 3g) :
//  - « diamètre de 5 m » → rayon 2,5 m (division Ø→rayon, cohérente avec les autres armes AOE).
//  - Armure : le RAW est silencieux sur l'interaction champ d'énergie ↔ protection physique →
//    `armorReductionFactor: 1` (armure normale). [INCONNU] — à confirmer avec Saar.
//
// Squelette cercle partagé : circleGrenade.js (buildShape, filtre, capacités, no-ops).

import {
  buildCircleShape, filterCircleHitTargets, CIRCLE_GRENADE_FLOW,
  noExtraTargets, noTargetRowModifier, noPostResolve,
} from './circleGrenade.js'

// Repli de rayon pour les fixtures — la migration 328 pose `radiusM: 2.5` sur la ligne catalogue.
const ENERGY_RADIUS_M = 2.5

function buildShape(ctx) {
  return buildCircleShape(ctx, ENERGY_RADIUS_M)
}

function filterTargets(ctx, visibilityTargets) {
  return filterCircleHitTargets({
    visibilityTargets,
    origin: ctx.aoeShape.origin,
    amplitudeM: ctx.aoeShape.amplitudeM, // figé par buildShape — une seule source
    metrics: ctx.metrics,
  })
}

// Dégât uniforme = jet de la formule d'arme (6D10), préparé par l'orchestrateur et passé en `baseRaw`.
// Pas de dé de dégression, pas de `mr` (`ctx.rollResult` jamais lu), pas de Choc. 1 Localisation,
// armure normale. Synchrone : aucun travail asynchrone (contrairement à grenadeFrag qui lance un dé).
function computeTargetDamage(ctx, ht, { baseRaw }) {
  return { degautsBruts: baseRaw, locationsCount: 1, armorReductionFactor: 1 }
}

export const grenadeEnergyMechanism = {
  buildShape,
  filterTargets,
  extraTargets: noExtraTargets,
  targetRowModifier: noTargetRowModifier,
  computeTargetDamage,
  postResolve: noPostResolve,
  ...CIRCLE_GRENADE_FLOW,
}
