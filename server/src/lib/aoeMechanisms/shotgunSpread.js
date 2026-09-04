// server/src/lib/aoeMechanisms/shotgunSpread.js
//
// Mécanisme AOE « shotgun_spread » (fusil à pompe) — objet stratégie consommé par le registre
// (registry.js), lui-même dispatché par le tronc (server/src/socket/socketCombatAoe.js). Segment 1.5
// (PLAN_ARMES_SPECIALES.md §1.4bis) — extraction pure des branches `mechanic === 'shotgun_spread'` du
// tronc (implicites : c'était la branche par défaut, `else` de chaque `mechanic === 'flamethrower' ? … : …`),
// AUCUN changement de comportement. `filterShotgunHitTargets` déplacée ici verbatim depuis
// socketCombatAoe.js (déplacement obligatoire, pas cosmétique : le tronc importe le registre pour
// dispatcher, la garder dans socketCombatAoe.js créerait un import circulaire registry→socketCombatAoe
// →registry).
//
// Contrat d'une entrée de registre (voir registry.js pour la forme exacte) :
//   buildShape(ctx) → AoeShape normalisée (origine incluse — CE mécanisme décide sa propre origine,
//     jamais imposée par le tronc ; ici position du tireur, comme un futur mécanisme `circle` lancé
//     calculera la sienne via shared/world/aoeShapes.js#resolveScatter sans toucher le tronc).
//   filterTargets(ctx, visibilityTargets) → hitTargets[] (pur).
//   extraTargets(ctx, hitTargets) → pseudoTargets[] — fusil à pompe : aucune (RAW ne prévoit pas
//     d'auto-éclaboussure pour une gerbe de plombs, contrairement au lance-flammes).
//   targetRowModifier(ht) → damage_modifier persisté dans combat_action_targets (palier + dé de
//     dispersion).
//   computeTargetDamage(ctx, ht, { effectiveDamage, baseRaw }) → { degautsBruts, locationsCount,
//     armorReductionFactor } — `effectiveDamage`/`baseRaw` sont préparés une fois par le tronc (communs
//     aux deux mécanismes existants), jamais refetchés ici.
//   postResolve(io, campaignId, ctx, perTargetResults) → emissions[] — fusil à pompe : aucun effet
//     post-résolution (contrairement au feu continu du lance-flammes).

import { parseDice } from '../diceParser.js'
import { computeAssaultRawDamage } from '../combatAttackRoll.js'
import { normalizeAoeShape, isPointInAoeShape } from '../../../../shared/world/aoeShapes.js'
import { dbPositionToWorldPoint } from '../../../../shared/world/worldMetrics.js'
import { resolveShotgunSpread, SHOTGUN_SPREAD_BY_BAND } from '../../../../shared/combatRange.js'

// ─── Ciblage — passe 2, PURE (déplacée verbatim depuis socketCombatAoe.js, segment 0d) ─────────────
//
// Les candidats viennent d'une requête bulk sur le couloir le PLUS LARGE possible (sur-inclusif) ;
// chacun est ici retesté contre la largeur RÉELLE de son propre palier RAW — deux passes géométriques
// plutôt qu'une approximation d'un cône à largeur continue (PLAN_AOE.md §4/§6.2bis). Fonction pure :
// aucune DB, aucune émission — testable avec des candidats fixtures.
//
// Exclusions :
//  - le tireur lui-même : jamais une cible normale de sa propre gerbe. Auparavant exclu SEULEMENT par
//    accident (sa distance à l'origine ≈ 0 → palier bout portant → `spread.widthM === null` →
//    `continue` ci-dessous). Explicite ici — l'accident ne tient plus dès qu'une autre forme (cône
//    lance-flammes) n'a pas ce filtre bout-portant (PLAN_ARMES_SPECIALES.md #3) ;
//  - hors ligne de vue (couche 3, `evaluateAoeVisibility`) ;
//  - bout portant (< 2 m) : RAW « le tir ne touche qu'une cible », pas de zone géométrique — une
//    action de zone déclarée sans cible unique ne touche donc personne à cette distance en v1.
export function filterShotgunHitTargets({ visibilityTargets, shooterTokenId, origin, directionDeg, refRange, amplitudeM, metrics }) {
  const hitTargets = []
  for (const candidate of visibilityTargets) {
    if (candidate.tokenId === shooterTokenId) continue
    if (!candidate.hasLineOfSight) continue
    const range = resolveShotgunSpread(candidate.distanceToOriginM, refRange)
    if (range.status !== 'ok' || range.spread.widthM === null) continue
    const narrowShape = normalizeAoeShape({ shape: 'ray', origin, directionDeg, amplitudeM, widthM: range.spread.widthM })
    if (!isPointInAoeShape(candidate.position, narrowShape, metrics)) continue
    hitTargets.push({ ...candidate, band: range.band, spread: range.spread })
  }
  return hitTargets
}

// Roule un dé signé de type "+1D10" / "-2D10" / "+0" → entier signé (0 pour "+0"/absent). Déplacé
// depuis socketCombatAoe.js — usage exclusif au dé de dispersion du fusil à pompe, jamais générique.
async function rollSignedDie(diceStr) {
  if (!diceStr || diceStr === '+0') return 0
  const sign = diceStr.startsWith('-') ? -1 : 1
  const rolled = await parseDice(diceStr.replace(/^[+-]/, ''))
  return sign * rolled.total
}

function buildShape(ctx) {
  const origin = dbPositionToWorldPoint(ctx.shooterToken)
  const widthM = Math.max(...Object.values(SHOTGUN_SPREAD_BY_BAND).map(band => band.widthM || 0))
  return normalizeAoeShape({ shape: 'ray', origin, directionDeg: ctx.aoe.direction, amplitudeM: ctx.amplitudeM, widthM })
}

function filterTargets(ctx, visibilityTargets) {
  return filterShotgunHitTargets({
    visibilityTargets, shooterTokenId: ctx.action.token_id, origin: ctx.aoeShape.origin,
    directionDeg: ctx.aoe.direction, refRange: ctx.weapon.ref_range, amplitudeM: ctx.amplitudeM, metrics: ctx.metrics,
  })
}

// Aucune auto-éclaboussure RAW pour une gerbe de plombs (contrairement au lance-flammes, décision B).
function extraTargets() {
  return []
}

// Persistance (§3) : palier + dé de dispersion propres à CETTE cible — `null` pour un mécanisme sans
// dispersion (lance-flammes).
function targetRowModifier(ht) {
  return { band: ht.band, damageDice: ht.spread.damageDice }
}

// Formule ammo-aware (comme resolveAssaultAction) + dé de dispersion signé du palier RAW propre à
// CETTE cible (§4). `portee: ht.band` ne fait que gater fire_mode_bonus_dmg au contact.
async function computeTargetDamage(ctx, ht, { baseRaw }) {
  const spreadRaw = await rollSignedDie(ht.spread.damageDice)
  const degautsBruts = computeAssaultRawDamage({
    rawDice: baseRaw + spreadRaw, mr: ctx.rollResult.mr, portee: ht.band, fireModeBonusDmg: ctx.action.fire_mode_bonus_dmg,
  })
  return { degautsBruts, locationsCount: 1, armorReductionFactor: 1 }
}

// Aucun effet post-résolution pour le fusil à pompe.
function postResolve() {
  return []
}

export const shotgunSpreadMechanism = {
  buildShape, filterTargets, extraTargets, targetRowModifier, computeTargetDamage, postResolve,
}
