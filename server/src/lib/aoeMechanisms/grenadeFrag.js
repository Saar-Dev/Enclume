// server/src/lib/aoeMechanisms/grenadeFrag.js
//
// Mécanisme AOE « grenade_frag » (grenade à fragmentation) — objet stratégie consommé par le registre
// (registry.js), lui-même dispatché par l'orchestrateur AOE. Segment 3 du chantier grenades
// (docs/PLANS/PLAN_GRENADES.md §7). Grenade `shape: 'circle'` : le squelette commun (géométrie du
// cercle, filtre LOS + in-zone, capacités de flux, hooks no-op) vit dans circleGrenade.js — ce
// fichier ne porte QUE ce qui est propre à la fragmentation : la dégression par palier.
//
// SÉMANTIQUE : fragmentation SEULE — pas de Choc (`Choc: -` au catalogue), pas de feu, pas de statut.
// concussion (extension d'étourdissement), sonique (dégression du Choc), rayons fixes = Segment 3-bis,
// une entrée de registre + un concern nouveau chacun (PLAN_GRENADES.md §6).
//
// HOOKS INVARIANTS À L'ORCHESTRATEUR (PLAN_GRENADES.md §7.1) : aucun hook ne lit `ctx.rollResult`,
// `ctx.weapon.ref_range`, la position de `ctx.shooterToken`, ni `ctx.metrics` autrement qu'en
// passe-plat vers le filtre géométrique.

import { parseDice, rollSignedDie } from '../diceParser.js'
import {
  buildCircleShape, filterCircleHitTargets, CIRCLE_GRENADE_FLOW, noExtraTargets, noPostResolve,
} from './circleGrenade.js'

// Table de dégression RAW + son accès : `shared/combatRange.js` (déplacés là au §10.2 — l'aperçu client
// dessine les anneaux concentriques et lit la MÊME table que ce résolveur, jamais une copie qui dérive ;
// même raison que `SHOTGUN_SPREAD_BY_BAND`, importé de là aussi par `shotgunSpread.js`).
// Re-export : `GRENADE_FRAG_MAX_RADIUS_M` / `resolveGrenadeBand` faisaient partie de l'API publique de
// ce module (tests, appelants) — surface inchangée.
import { GRENADE_FRAG_MAX_RADIUS_M, resolveGrenadeBand } from '../../../../shared/combatRange.js'
export { GRENADE_FRAG_MAX_RADIUS_M, resolveGrenadeBand }

// ─── Ciblage — PURE (frère de filterShotgunHitTargets / filterFlamethrowerHitTargets) ──────────────
//
// Le filtre géométrique commun (LOS clair + dans le cercle, cercle reconstruit depuis origin+amplitude
// pour l'auto-suffisance) est `filterCircleHitTargets` (circleGrenade.js). La fragmentation ajoute par
// cible son palier de dégression (`resolveGrenadeBand` sur la distance au point d'impact ; borne
// 15 m = `GRENADE_FRAG_MAX_RADIUS_M`, au-delà « rien n'est affecté » — RAW). Le lanceur n'est jamais
// exclu : une grenade déviée (dispersion, 3d) peut retomber sur lui (RAW, PLAN_AOE.md §5.5).
export function filterGrenadeFragHitTargets({ visibilityTargets, origin, amplitudeM = GRENADE_FRAG_MAX_RADIUS_M, metrics }) {
  return filterCircleHitTargets({ visibilityTargets, origin, amplitudeM, metrics })
    .map((candidate) => {
      const frag = resolveGrenadeBand(candidate.distanceToOriginM)
      return { ...candidate, band: frag.name, frag }
    })
}

// ─── Hooks du registre ────────────────────────────────────────────────────────────────────────────

// Cercle centré sur le POINT D'IMPACT déjà résolu (`ctx.aoe.resolvedOrigin` — posé par l'orchestrateur
// après le Test de Coordination et l'éventuelle dispersion ; en fixtures, fourni directement).
// `resolveScatter` n'est PAS appelé ici (il a besoin de la marge du Test, domaine combat). Rayon =
// `aoe_profile.radiusM` de l'arme (catalogue), repli `GRENADE_FRAG_MAX_RADIUS_M` pour les fixtures —
// pour grenade_frag il DOIT valoir la borne du dernier palier de dégression. `buildCircleShape` :
// circleGrenade.js.
function buildShape(ctx) {
  return buildCircleShape(ctx, GRENADE_FRAG_MAX_RADIUS_M)
}

function filterTargets(ctx, visibilityTargets) {
  return filterGrenadeFragHitTargets({
    visibilityTargets,
    origin: ctx.aoeShape.origin,
    amplitudeM: ctx.aoeShape.amplitudeM, // = rayon figé par buildShape — une seule source
    metrics: ctx.metrics,
  })
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

export const grenadeFragMechanism = {
  buildShape,
  filterTargets,
  extraTargets: noExtraTargets,
  targetRowModifier,
  computeTargetDamage,
  postResolve: noPostResolve,
  // Capacités de flux communes aux grenades cercle — voir circleGrenade.js#CIRCLE_GRENADE_FLOW
  // (amplitude depuis le mécanisme, consommée au lancer, LOS depuis le point d'impact, pas de Phase A).
  ...CIRCLE_GRENADE_FLOW,
}
