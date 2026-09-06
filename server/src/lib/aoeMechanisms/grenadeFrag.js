// server/src/lib/aoeMechanisms/grenadeFrag.js
//
// Mécanisme AOE « grenade_frag » (grenade à fragmentation) — objet stratégie consommé par le registre
// (registry.js), lui-même dispatché par l'orchestrateur AOE. Segment 3 du chantier grenades
// (docs/PLANS/PLAN_GRENADES.md §7). Frère de shotgunSpread.js / flamethrower.js — même forme de hooks.
//
// PÉRIMÈTRE 3a : ce fichier ne modélise QUE l'explosion — origine (point d'impact) donnée, profil de
// zone → dégâts par cible avec dégression par palier. Il ne fait NI le lancer, NI le Test de
// Coordination, NI la dispersion (`resolveScatter`), NI le différé inter-tours. Ces points sont
// 3c/3d/3e, chacun avec sa propre étape (PLAN_GRENADES.md §5/§6).
//
// SÉMANTIQUE : fragmentation SEULE — pas de Choc (`Choc: -` au catalogue), pas de feu, pas de statut.
// concussion (extension d'étourdissement), sonique (dégression du Choc), rayons fixes = Segment 3-bis,
// une entrée de registre + un concern nouveau chacun (PLAN_GRENADES.md §6).
//
// HOOKS INVARIANTS À L'ORCHESTRATEUR (PLAN_GRENADES.md §7.1) : aucun hook ne lit `ctx.rollResult`,
// `ctx.weapon.ref_range`, la position de `ctx.shooterToken`, ni `ctx.metrics` autrement qu'en
// passe-plat vers `isPointInAoeShape`. Le mécanisme reste bon que l'orchestrateur runtime (3e) soit
// `resolveAoeAssaultAction` bardé de branches OU un nouveau `socketCombatGrenade.js`.

import { parseDice, rollSignedDie } from '../diceParser.js'
import { normalizeAoeShape, isPointInAoeShape } from '../../../../shared/world/aoeShapes.js'
import { normalizeDistanceBands, resolveDistanceBand } from '../../../../shared/world/distanceBands.js'

// ─── Table de dégression RAW (docs/REGLES/REGLES_ARMES_SPECIALES.md § « Grenades et mines ») ────────
//
// Le RAW exprime les paliers en DIAMÈTRE de zone d'effet. Lecture retenue (PLAN_GRENADES.md §1,
// [HYPOTHÈSE] — seule lecture cohérente, écart candidat JOURNAL8) : une cible à distance `r` du point
// d'explosion est dans le palier de diamètre `2r` → `maxDistanceM` = rayon.
//   Centre  (Ø < 2 m,  r ≤ 1 m)    : 1D3 Localisations, dégâts +1D10.
//   Courte  (Ø 2-5 m,  r ≤ 2,5 m)  : dégâts normaux.
//   Moyenne (Ø 5-10 m, r ≤ 5 m)    : -1D10.
//   Longue  (Ø 10-20 m, r ≤ 10 m)  : -2D10, Test de Chance.
//   Extrême (Ø 20-30 m, r ≤ 15 m)  : -3D10, Test de Chance (+5).
//   Au-delà de r = 15 m : « Rien d'autre n'est affecté » → la cible est déjà exclue par
//   `isPointInAoeShape(circle, GRENADE_FRAG_MAX_RADIUS_M)` AVANT tout appel à `resolveGrenadeBand`
//   (les deux ne sont jamais découplés — même discipline que shared/world/distanceBands.js).
//
// `damageDice` : chaîne SIGNÉE passée à `rollSignedDie` (comme SHOTGUN_SPREAD_BY_BAND). `+0` = neutre.
// `chanceTest` / `chanceBonus` : donnée RAW LATENTE — pas consommée en v1 (chantier Chance,
// docs/PLANS/PLAN_CHANCE.md), portée ici comme `savePossible`/`saveBonus` l'est déjà côté fusil à pompe.
// `locationsDice` : présent uniquement sur le palier centre (1D3 Localisations) ; absent ailleurs → 1.
const GRENADE_FRAG_BANDS = normalizeDistanceBands([
  { name: 'centre',  maxDistanceM: 1,   damageDice: '+1D10', locationsDice: '1D3', chanceTest: false, chanceBonus: 0 },
  { name: 'courte',  maxDistanceM: 2.5, damageDice: '+0',                          chanceTest: false, chanceBonus: 0 },
  { name: 'moyenne', maxDistanceM: 5,   damageDice: '-1D10',                       chanceTest: false, chanceBonus: 0 },
  { name: 'longue',  maxDistanceM: 10,  damageDice: '-2D10',                       chanceTest: true,  chanceBonus: 0 },
  { name: 'extreme', maxDistanceM: 15,  damageDice: '-3D10',                       chanceTest: true,  chanceBonus: 5 },
])

// Rayon maximal d'effet = borne du dernier palier (une seule source de vérité — jamais un `15` en dur
// à côté de la table).
export const GRENADE_FRAG_MAX_RADIUS_M = GRENADE_FRAG_BANDS[GRENADE_FRAG_BANDS.length - 1].maxDistanceM

// resolveGrenadeBand — palier de dégression pour une distance au point d'explosion. `bands` déjà
// normalisée au chargement du module → `resolveDistanceBand` ne fait que chercher (bon marché en
// boucle multi-cibles). Exportée : testée directement (PLAN_GRENADES.md §7.5).
export function resolveGrenadeBand(distanceM) {
  return resolveDistanceBand(distanceM, GRENADE_FRAG_BANDS)
}

// ─── Ciblage — PURE (frère de filterShotgunHitTargets / filterFlamethrowerHitTargets) ──────────────
//
// Plus simple que le fusil à pompe (pas de couloir grossier à re-tester par palier) : le cercle testé
// ICI est la forme finale. On re-teste quand même `isPointInAoeShape` pour que la fonction soit
// auto-suffisante et testable sans faire confiance au pré-filtrage de l'appelant (même discipline que
// la passe 2 du fusil à pompe et le cône du lance-flammes).
//
// Le lanceur N'EST PAS exclu : une grenade qui dévie (dispersion, 3d) peut retomber sur lui, RAW —
// PLAN_AOE.md §5.5, « pas d'exclusion silencieuse du lanceur ». Contrairement au cône du lance-flammes
// (origine = position du tireur, toujours dedans), ici l'origine est le point d'impact : le lanceur
// n'est un candidat que si le souffle l'atteint géométriquement.
export function filterGrenadeFragHitTargets({ visibilityTargets, origin, amplitudeM = GRENADE_FRAG_MAX_RADIUS_M, metrics }) {
  const circle = normalizeAoeShape({ shape: 'circle', origin, amplitudeM })
  const hitTargets = []
  for (const candidate of visibilityTargets) {
    if (!candidate.hasLineOfSight) continue
    if (!isPointInAoeShape(candidate.position, circle, metrics)) continue
    const frag = resolveGrenadeBand(candidate.distanceToOriginM)
    hitTargets.push({ ...candidate, band: frag.name, frag })
  }
  return hitTargets
}

// ─── Hooks du registre ────────────────────────────────────────────────────────────────────────────

// Rayon d'effet = `aoe_profile.radiusM` de l'arme (donnée catalogue, autorité unique — comme
// `angleDeg` pour le cône du lance-flammes ; l'aperçu client lit la même valeur). Repli
// `GRENADE_FRAG_MAX_RADIUS_M` pour les fixtures / une ligne catalogue sans `radiusM` (jamais en prod
// une fois la migration passée). Pour `grenade_frag`, `radiusM` doit valoir la borne du dernier
// palier de dégression (`GRENADE_FRAG_BANDS`) — au-delà, RAW « rien n'est affecté ».
function aoeRadiusM(ctx) {
  return ctx.weapon?.ref_aoe_profile?.radiusM ?? GRENADE_FRAG_MAX_RADIUS_M
}

// Cercle centré sur le POINT D'IMPACT déjà résolu (`ctx.aoe.resolvedOrigin` — posé par l'orchestrateur
// en 3d, après le Test de Coordination et l'éventuelle dispersion ; en fixtures, fourni directement).
// `resolveScatter` N'EST PAS appelé ici : il a besoin de la marge du Test, domaine combat, pas
// géométrie de forme. Strict : pas de repli sur `intendedOrigin` — l'orchestrateur pose toujours
// `resolvedOrigin` (= intended si le jet réussit).
function buildShape(ctx) {
  return normalizeAoeShape({
    shape: 'circle',
    origin: ctx.aoe.resolvedOrigin,
    amplitudeM: aoeRadiusM(ctx),
  })
}

function filterTargets(ctx, visibilityTargets) {
  return filterGrenadeFragHitTargets({
    visibilityTargets,
    origin: ctx.aoeShape.origin,
    amplitudeM: ctx.aoeShape.amplitudeM, // = aoeRadiusM(ctx), figé par buildShape — une seule source
    metrics: ctx.metrics,
  })
}

// Aucune pseudo-cible : le lanceur pris dans le souffle est déjà une cible normale via `filterTargets`
// (contrairement à l'auto-éclaboussure < 3 m du lance-flammes, contrôle séparé).
function extraTargets() {
  return []
}

// Persistance (§3 PLAN_AOE) : palier + dé de dégression propres à CETTE cible — miroir exact de
// shotgunSpread.targetRowModifier (`{ band, damageDice }`).
function targetRowModifier(ht) {
  return { band: ht.band, damageDice: ht.frag.damageDice }
}

// Dégât brut = formule d'arme (5D10, préparée par l'orchestrateur) + dé de dégression signé du palier
// RAW. PAS de `mr` (l'échec du Test de Coordination DÉPLACE le point d'impact, il ne réduit rien —
// PLAN_GRENADES.md §5 pt 3), PAS de `fireModeBonusDmg`. 1D3 Localisations au centre, sinon 1.
// `armorReductionFactor: 1` — protections individuelles normales contre les grenades (RAW).
async function computeTargetDamage(ctx, ht, { baseRaw }) {
  const spreadRaw = await rollSignedDie(ht.frag.damageDice)
  const degautsBruts = baseRaw + spreadRaw
  const locationsCount = ht.frag.locationsDice ? (await parseDice(ht.frag.locationsDice)).total : 1
  return { degautsBruts, locationsCount, armorReductionFactor: 1 }
}

// Fragmentation pure : aucun effet post-résolution (concussion / feu / statut = Segment 3-bis).
function postResolve() {
  return []
}

export const grenadeFragMechanism = {
  buildShape, filterTargets, extraTargets, targetRowModifier, computeTargetDamage, postResolve,
  // ─── Capacités de flux (PLAN_GRENADES.md §5, Segment 3b) ─────────────────────────────────────────
  // Propriétés non-hook lues par `resolveAoeAssaultAction` avec un défaut = comportement historique.
  // Un mécanisme ne déclare QUE ce qui diffère du défaut (fusil à pompe / lance-flammes n'en ont
  // aucune). La grenade s'écarte sur trois axes :
  //  - `needsWeaponRange: false` — pas de colonne `ref_range` ; l'amplitude vient du mécanisme
  //    (`GRENADE_FRAG_MAX_RADIUS_M` dans `buildShape`), pas de `parseWeaponRangeBands`.
  //  - `decrementsAmmo: false` — une grenade est consommée au LANCER (T1), jamais à l'explosion.
  //  - `losSource: 'origin'` — la LOS de l'explosion part du POINT D'IMPACT, pas du lanceur : une
  //    cible masquée pour le lanceur mais à découvert du souffle EST touchée.
  // `rollsPhaseA` (jet de compétence d'arme) : PAS déclaré ici — le Test de Coordination du lancer
  // est câblé au Segment 3d, avec sa source de `rollResult` (jusque-là, le tronc roule un jet de
  // compétence cosmétiquement faux mais sans effet sur le dégât, qui ignore `mr`).
  needsWeaponRange: false,
  decrementsAmmo: false,
  losSource: 'origin',
}
