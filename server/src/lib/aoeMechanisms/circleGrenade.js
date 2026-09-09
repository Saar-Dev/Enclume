// server/src/lib/aoeMechanisms/circleGrenade.js
//
// Squelette partagé des mécanismes AOE `shape: 'circle'` — grenades lancées sur un point au sol
// (PLAN_GRENADES.md §6, Segment 3-bis). Toutes partagent la même géométrie (cercle centré sur le
// point d'impact résolu) et le même profil de flux ; elles ne divergent QUE sur `computeTargetDamage`
// et, parfois, sur l'enrichissement des cibles (`grenade_frag` ajoute un palier de dégression) ou un
// effet `postResolve` (feu, statut — Segments 3-bis suivants).
//
// Frère de shotgunSpread.js / flamethrower.js pour le cône/rayon. N'importe AUCUN mécanisme concret —
// c'est l'inverse : les mécanismes concrets importent d'ici (grenadeEnergy.js, grenadeFrag.js…).

import { normalizeAoeShape, isPointInAoeShape } from '../../../../shared/world/aoeShapes.js'

// buildCircleShape — cercle centré sur le point d'impact déjà résolu (`ctx.aoe.resolvedOrigin`, posé
// par l'orchestrateur après le Test de Coordination + l'éventuelle dispersion ; fourni directement en
// fixtures). Rayon = `aoe_profile.radiusM` de l'arme (autorité unique catalogue, comme `angleDeg`
// pour le cône du lance-flammes). `fallbackRadiusM` sert aux fixtures / à une ligne catalogue sans
// `radiusM` — jamais en prod une fois la migration passée.
export function buildCircleShape(ctx, fallbackRadiusM) {
  return normalizeAoeShape({
    shape: 'circle',
    origin: ctx.aoe.resolvedOrigin,
    amplitudeM: ctx.weapon?.ref_aoe_profile?.radiusM ?? fallbackRadiusM,
  })
}

// filterCircleHitTargets — PURE. Reconstruit le cercle depuis `origin`+`amplitudeM` pour être
// auto-suffisante : ne fait pas confiance au pré-filtrage géométrique large de `queryTokensInShape`,
// même discipline que la passe 2 du fusil à pompe et le cône du lance-flammes. Retenu : LOS clair
// ET dans le cercle. AUCUN enrichissement — un mécanisme qui a besoin d'un palier (`grenade_frag`)
// mappe par-dessus. Le lanceur n'est jamais exclu ici : une grenade déviée peut retomber sur lui
// (RAW, PLAN_AOE.md §5.5) et l'origine étant le point d'impact, il n'est candidat que si le souffle
// l'atteint géométriquement.
export function filterCircleHitTargets({ visibilityTargets, origin, amplitudeM, metrics }) {
  const circle = normalizeAoeShape({ shape: 'circle', origin, amplitudeM })
  return visibilityTargets.filter(candidate =>
    candidate.hasLineOfSight && isPointInAoeShape(candidate.position, circle, metrics),
  )
}

// CIRCLE_GRENADE_FLOW — capacités de flux lues par `resolveAoeAssaultAction` (PLAN_GRENADES.md §5).
// Identiques pour TOUTE grenade cercle : amplitude depuis le mécanisme (pas `ref_range`), consommée
// au lancer (jamais à l'explosion), LOS depuis le point d'impact, pas de Phase A (le seul jet est le
// Test de Coordination du lancer). Un mécanisme concret le spread : `{ ...hooks, ...CIRCLE_GRENADE_FLOW }`.
export const CIRCLE_GRENADE_FLOW = Object.freeze({
  needsWeaponRange: false,
  decrementsAmmo: false,
  losSource: 'origin',
  rollsPhaseA: false,
})

// Hooks no-op nommés — une grenade cercle sans pseudo-cible / sans modificateur de ligne / sans effet
// post-résolution les référence directement (chaque hook reste visible dans l'objet mécanisme).
export const noExtraTargets = () => []
export const noTargetRowModifier = () => null
export const noPostResolve = () => []
