// server/src/lib/aoeMechanisms/flamethrower.js
//
// Mécanisme AOE « flamethrower » (lance-flammes) — objet stratégie consommé par le registre
// (registry.js), lui-même dispatché par le tronc (server/src/socket/socketCombatAoe.js). Segment 1.5
// (PLAN_ARMES_SPECIALES.md §1.4bis) — extraction pure des branches `mechanic === 'flamethrower'` du
// tronc, AUCUN changement de comportement. `filterFlamethrowerHitTargets` et
// `applyFlamethrowerContinuousFire` déplacées ici verbatim depuis socketCombatAoe.js (déplacement
// obligatoire, pas cosmétique : le tronc importe le registre pour dispatcher, les garder dans
// socketCombatAoe.js créerait un import circulaire registry→socketCombatAoe→registry).
//
// Contrat d'une entrée de registre — voir shotgunSpread.js pour le détail de chaque hook (même forme
// exacte, dupliquée ici volontairement pour que ce fichier reste lisible seul).

import db from '../../db/knex.js'
import { parseDice } from '../diceParser.js'
import { computeAssaultRawDamage } from '../combatAttackRoll.js'
import { normalizeAoeShape, isPointInAoeShape } from '../../../../shared/world/aoeShapes.js'
import { dbPositionToWorldPoint } from '../../../../shared/world/worldMetrics.js'
import { WS } from '../../../../shared/events.js'
import { exposeToHazard } from '../environmentalHazardService.js'

// ─── Ciblage — PURE (déplacée verbatim depuis socketCombatAoe.js, segment 1e) ──────────────────────
//
// Sœur de filterShotgunHitTargets, en plus simple : le cône a un angle FIXE (aoe_profile.angleDeg),
// pas une largeur qui croît par paliers — une seule passe géométrique, pas de largeur réelle à
// retester par candidat, pas de dé de dispersion (`band: null` : le lance-flammes ne dégresse pas
// avec la portée, RAW). La forme testée ici EST la forme finale (contrairement au couloir grossier
// sur-inclusif du fusil à pompe) ; on re-teste quand même `isPointInAoeShape` pour que la fonction
// soit auto-suffisante et testable sans faire confiance au pré-filtrage de l'appelant (même
// discipline que la passe 2 du fusil à pompe).
//
// Exclusions identiques : le tireur lui-même (jamais une cible normale de son propre jet — #3 ;
// l'auto-éclaboussure < 3 m de la décision B est un contrôle SÉPARÉ, ajouté par `extraTargets`
// ci-dessous), et hors ligne de vue (couche 3).
export function filterFlamethrowerHitTargets({ visibilityTargets, shooterTokenId, origin, directionDeg, amplitudeM, angleDeg, metrics }) {
  const coneShape = normalizeAoeShape({ shape: 'cone', origin, directionDeg, amplitudeM, angleDeg })
  const hitTargets = []
  for (const candidate of visibilityTargets) {
    if (candidate.tokenId === shooterTokenId) continue
    if (!candidate.hasLineOfSight) continue
    if (!isPointInAoeShape(candidate.position, coneShape, metrics)) continue
    hitTargets.push({ ...candidate, band: null })
  }
  return hitTargets
}

// applyFlamethrowerContinuousFire — effets propres au lance-flammes, APRÈS finalizeAoeResults (ils ne
// modifient pas l'agrégat de résultats déjà émis). PLAN_ARMES_SPECIALES.md §1.1/§1.5 :
//  - feu continu : RAW « le liquide continue de brûler, 2D10/Tour pendant 2D6 Tours » recoupé au RAW
//    « grand feu » (docs/REGLES/REGLEBLESSURES.md — 2D10/Tour sur 1D3 Localisation(s)) →
//    exposeToHazard('burning', { formula:'2D10', locations:'1D3', durationDice:'2D6' }) sur chaque
//    cible HUMANOÏDE touchée. Drone/exo exclus : le tick de danger ignore déjà les drones, et
//    l'armure scellée d'une exo ne prend pas feu (décision D — cohérent avec le ÷2 réservé à la fiche) ;
//  - UNE notice système agrégée : l'id client d'une notice = i18nKey + timestamp (useSessionSocket.js),
//    N notices même clé/instant entreraient en collision de `key` React → une seule ligne listant les
//    cibles en feu ;
//  - `selfSplash` (décision B) : une notice explicative dédiée — le tireur s'est éclaboussé en tirant
//    en cône à moins de 3 m d'une cible ; ses dégâts + son feu continu ont déjà été résolus comme
//    pseudo-cible dans la boucle principale (`extraTargets` ci-dessous).
async function applyFlamethrowerContinuousFire(io, campaignId, { perTargetResults, selfSplash, character, shooterToken }) {
  const emissions = []
  const timestamp = new Date().toISOString()
  const burnedLabels = []
  for (const ptr of perTargetResults) {
    if (ptr.cibleType == null || ptr.cibleType === 'drone' || ptr.cibleType === 'exo') continue
    // Résilient : le dégât d'impact est déjà résolu et persisté — un échec d'exposition au feu ne doit
    // pas faire remonter une exception qui, via le catch du tronc, jetterait tout l'agrégat déjà émis
    // (même philosophie que resolveEnvironmentalHazardTicks : échec silencieux > résolution cassée).
    try {
      await exposeToHazard(io, db, campaignId, ptr.tokenId, 'burning', {
        formula: '2D10', locations: '1D3', durationDice: '2D6',
      })
      burnedLabels.push(ptr.name)
    } catch (err) {
      console.error(`[WS] applyFlamethrowerContinuousFire — exposeToHazard échec token:${ptr.tokenId}:`, err.message)
    }
  }
  if (burnedLabels.length > 0) {
    emissions.push({ to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: {
      i18nKey: 'session.onFire', params: { labels: burnedLabels.join(', ') }, timestamp,
    } })
  }
  if (selfSplash) {
    emissions.push({ to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: {
      i18nKey: 'session.flamethrowerSelfSplash',
      params: { label: character.name ?? shooterToken.label ?? '?' }, timestamp,
    } })
  }
  return emissions
}

function buildShape(ctx) {
  const origin = dbPositionToWorldPoint(ctx.shooterToken)
  const angleDeg = ctx.weapon.ref_aoe_profile?.angleDeg
  return normalizeAoeShape({ shape: 'cone', origin, directionDeg: ctx.aoe.direction, amplitudeM: ctx.amplitudeM, angleDeg })
}

function filterTargets(ctx, visibilityTargets) {
  return filterFlamethrowerHitTargets({
    visibilityTargets, shooterTokenId: ctx.action.token_id, origin: ctx.aoeShape.origin,
    directionDeg: ctx.aoe.direction, amplitudeM: ctx.amplitudeM, angleDeg: ctx.aoeShape.angleDeg, metrics: ctx.metrics,
  })
}

// Décision B (PLAN_ARMES_SPECIALES.md §1.5-B) : si une AUTRE cible touchée est à < 3 m du tireur, le
// liquide enflammé l'éclabousse → il devient une pseudo-cible de son propre cône (1 Localisation, pas
// un passage complet 1D3 ; armure ÷2 et Choc comme toute cible du cône, via computeTargetDamage
// ci-dessous — `ht.isSelfSplash` y est lu). Message explicatif dédié émis par postResolve.
function extraTargets(ctx, hitTargets) {
  const selfSplash = hitTargets.some(ht => ht.tokenId !== ctx.action.token_id && ht.distanceToOriginM < 3)
  if (!selfSplash) return []
  return [{
    tokenId: ctx.action.token_id, distanceToOriginM: 0, position: ctx.aoeShape.origin, hasLineOfSight: true,
    band: null, isSelfSplash: true,
  }]
}

// Aucune dispersion pour le lance-flammes (le dégât ne dégresse pas avec la portée, RAW) — jamais de
// damage_modifier persisté.
function targetRowModifier() {
  return null
}

// 2D10 sec (RAW) — PAS de dé de dispersion, PAS de dégression de portée, PAS de bonus RL (`portee:
// null` → computeAssaultRawDamage ne verse pas fire_mode_bonus_dmg : le RL du lance-flammes EST la
// mise en œuvre continue, il n'ajoute pas de dé de dégât — écart JOURNAL8). `mr` conservé : RAW « le
// modificateur d'échec réduit les dégâts ». 1D3 Localisations par cible (auto-éclaboussure : 1 seule) ;
// armure de fiche ÷2 (décision D).
async function computeTargetDamage(ctx, ht, { baseRaw }) {
  const degautsBruts = computeAssaultRawDamage({ rawDice: baseRaw, mr: ctx.rollResult.mr, portee: null, fireModeBonusDmg: null })
  const locationsCount = ht.isSelfSplash ? 1 : (await parseDice('1D3')).total
  return { degautsBruts, locationsCount, armorReductionFactor: 0.5 }
}

// Feu continu sur les cibles humanoïdes touchées + message d'auto-éclaboussure — post-résolution, ne
// modifie pas l'agrégat déjà émis par finalizeAoeResults. `selfSplash` = `ctx.hadExtraTargets`, posé
// par le tronc juste après l'appel à `extraTargets` (générique : un futur mécanisme peut aussi ajouter
// des pseudo-cibles pour une raison différente, ce champ ne présume que « au moins une a été ajoutée »).
async function postResolve(io, campaignId, ctx, perTargetResults) {
  return applyFlamethrowerContinuousFire(io, campaignId, {
    perTargetResults, selfSplash: ctx.hadExtraTargets, character: ctx.character, shooterToken: ctx.shooterToken,
  })
}

export const flamethrowerMechanism = {
  buildShape, filterTargets, extraTargets, targetRowModifier, computeTargetDamage, postResolve,
}
