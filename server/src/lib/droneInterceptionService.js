import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { parseDice } from './diceParser.js'
import {
  resolveTestOutcome, getCriticalSuccessBonus, applyCriticalSuccessBonus,
} from '../../../shared/polarisTestResolution.js'
import { resolveCriticalFailReroll } from './criticalFailReroll.js'
import { maybeTriggerCatastrophe } from './catastropheService.js'
import { isDroneTelepilotedThisTurn } from './droneTelepilotState.js'
import { emitExecutedTokenMovement } from './tokenMovementEmitter.js'
import { getCharacterMovementBudget, MovementBudgetError } from '../services/movementBudgetService.js'
import { planBattlemapTokenMovement, executeBattlemapTokenMovement } from '../services/worldMovementService.js'
import { listProtectorLinks } from '../services/droneInterceptionLinksService.js'
import { dbPositionToWorldPoint } from '../../../shared/world/worldMetrics.js'
import { actorEyePoint, normalizeVisibilityProfile } from '../../../shared/world/visibility.js'
import { createSegmentCellPredicate } from '../../../shared/world/gridCells.js'
import { ATTACK_KINDS, screenCandidates, pickProtector, isInterposed } from '../../../shared/droneInterception.js'

// Interposition d'un drone protecteur — coquille serveur (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.3).
// Toute la décision (éligibilité, choix du protecteur, marge strictement supérieure) vit dans le noyau pur
// shared/droneInterception.js ; ce module rassemble les données, plane le trajet, lance le Test, déplace le
// drone et émet. Appelé depuis les DEUX finalisations de Tir (socketCombatHelpers.js) : un seul point
// d'accroche par famille de tireur, moment « touché, avant dégâts ».

const DRONE_COLOR = '#30aaaa' // même couleur que les autres Tests de drone (Détection, Armement)

// Compte rendu en chat (demande Saar 2026-09-24) : un drone qui ne fait rien doit dire pourquoi. i18n
// (rules/i18n.md) : clés `session.drone*`, jamais de texte français figé émis par le serveur.
const systemNotice = (i18nKey, params) => ({
  to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: { i18nKey, params, timestamp: new Date().toISOString() },
})

// Tir RATÉ visant un protégé : rien à intercepter, le drone ne bouge pas (décision Saar 2026-09-24) — mais le
// chat le dit, sinon on ne sait pas si le drone a été oublié. Silencieux sans lien de protection, et pour tout
// ce qui n'est pas un Tir (le corps à corps n'est jamais intercepté). Retourne des `emissions` (vides au besoin).
export async function reportProtectedMiss(campaignId, { action, attackKind }) {
  try {
    if (attackKind !== 'ranged' || !action?.target_token_id) return []
    const targetToken = await db('tokens').where({ id: action.target_token_id }).first()
    if (!targetToken?.character_id) return []
    const droneCharacterIds = await listProtectorLinks(targetToken.character_id)
    if (droneCharacterIds.length === 0) return []
    const drones = await db('characters').whereIn('id', droneCharacterIds).select('name')
    const target = (await db('characters').where({ id: targetToken.character_id }).select('name').first())?.name
      ?? targetToken.label ?? '?'
    console.log(`[DBG] interposition — tir raté sur ${target} (protégé par ${drones.length} drone(s)) : rien à intercepter`)
    return [systemNotice('session.droneMissNothingToIntercept', { target, drones: drones.map(d => d.name).join(', ') })]
  } catch (err) {
    console.error('[WS] reportProtectedMiss error:', err.message) // un compte rendu raté ne doit jamais perdre le tir
    return []
  }
}

// Trajectoire du tir, en points « yeux à yeux » comme la LOS (worldVisibilityService.evaluateWorldVisibility) :
// même ligne, même autorité pour la hauteur de corps (profil par défaut, en unités monde).
function shotTrajectory(shooterToken, targetToken) {
  const profile = normalizeVisibilityProfile({})
  return {
    from: actorEyePoint(dbPositionToWorldPoint(shooterToken), profile),
    to: actorEyePoint(dbPositionToWorldPoint(targetToken), profile),
    bodyHeight: profile.height,
  }
}

// Données brutes d'un candidat (voir shared/droneInterception.js). `reachable` est calculé plus tard.
async function gatherCandidates(campaignId, droneCharacterIds, { targetToken, action }) {
  const candidates = []
  for (const droneCharacterId of droneCharacterIds) {
    const [character, sheet, program, sameMapToken] = await Promise.all([
      db('characters').where({ id: droneCharacterId }).first(),
      db('drone_sheet').where({ character_id: droneCharacterId }).first(),
      db('drone_programs').where({ character_id: droneCharacterId, category: 'interception' }).orderBy('level', 'desc').first(),
      db('tokens').where({ character_id: droneCharacterId, battlemap_id: targetToken.battlemap_id }).first(),
    ])
    if (!character || character.type !== 'drone') continue
    // Token sur la battlemap du tir ; à défaut n'importe quel token du drone (motif « autre battlemap »).
    const token = sameMapToken ?? (await db('tokens').where({ character_id: droneCharacterId }).first())

    let speedM = null
    try {
      speedM = (await getCharacterMovementBudget(droneCharacterId, 'max')).budgetM
    } catch (error) {
      if (!(error instanceof MovementBudgetError)) throw error // vitesse absente = inéligible, le reste est un vrai bug
    }
    candidates.push({
      droneTokenId: token?.id ?? droneCharacterId,
      droneCharacterId,
      droneName: character.name ?? token?.label ?? 'Drone',
      droneUserId: character.user_id ?? null,
      token,
      level: program ? Number(program.level) : null,
      integrity: sheet?.integrite_actuelle ?? 0,
      tokenBattlemapId: token?.battlemap_id ?? null,
      tokenHidden: token?.layer === 'gm',
      shotBattlemapId: targetToken.battlemap_id,
      isTarget: token?.id === action.target_token_id,
      telepilotedThisTurn: token ? await isDroneTelepilotedThisTurn(campaignId, droneCharacterId, token.id) : false,
      speedM,
    })
  }
  return candidates
}

// Tir de la LOS : retire des « intercepteurs » géométriques (tokens sur la ligne de tir, losService) les
// drones qui protègent la cible ET peuvent réellement intercepter — ils passent par leur Test, pas par la
// redirection automatique. Un protecteur INÉLIGIBLE sur la ligne reste un obstacle géométrique comme avant
// (le retirer ferait disparaître un obstacle réel). Un drone qui est déjà sur la ligne est à coût 0 de la
// trajectoire : la portée n'a pas à être recalculée ici, seul le tri « sans la portée » compte.
export async function filterProtectorInterceptors(campaignId, { action, targetToken, interceptors }) {
  try {
    return await filterProtectorInterceptorsUnsafe(campaignId, { action, targetToken, interceptors })
  } catch (err) {
    console.error('[WS] filterProtectorInterceptors error:', err.message)
    return interceptors // comportement historique : tout token sur la ligne redirige
  }
}

async function filterProtectorInterceptorsUnsafe(campaignId, { action, targetToken, interceptors }) {
  if (!interceptors.length || !targetToken?.character_id) return interceptors
  const protectorIds = await listProtectorLinks(targetToken.character_id)
  if (protectorIds.length === 0) return interceptors

  const interceptorTokens = await db('tokens').whereIn('id', interceptors.map(i => i.actorId))
  const protectorTokenIds = new Set(interceptorTokens.filter(t => protectorIds.includes(t.character_id)).map(t => t.id))
  if (protectorTokenIds.size === 0) return interceptors

  const candidates = await gatherCandidates(
    campaignId,
    [...new Set(interceptorTokens.filter(t => protectorTokenIds.has(t.id)).map(t => t.character_id))],
    { targetToken, action },
  )
  const { screened } = screenCandidates(candidates, { attackKind: 'ranged' })
  const excluded = new Set(screened.map(c => c.droneTokenId))
  return interceptors.filter(i => !excluded.has(i.actorId))
}

async function rollInterceptionTest(io, campaignId, protector, action) {
  const { total: roll, rolls, seed } = await parseDice('1d20')
  const outcomeCrit = applyCriticalSuccessBonus(
    resolveTestOutcome(roll, protector.level),
    getCriticalSuccessBonus({ masteryLevel: protector.level }),
  )
  const outcome = await resolveCriticalFailReroll(outcomeCrit)
  const userRow = protector.droneUserId
    ? await db('users').where({ id: protector.droneUserId }).select('color', 'username').first()
    : null
  const emission = { to: 'room', event: WS.DICE_RESULT, data: {
    userId: protector.droneUserId, username: userRow?.username ?? protector.droneName, color: userRow?.color ?? DRONE_COLOR,
    formula: '1d20', rolls, total: roll,
    isCriticalSuccess: outcome.isCriticalSuccess, isCriticalFail: outcome.isCriticalFail,
    catastropheRisk: outcome.catastropheRisk,
    seed, timestamp: new Date().toISOString(),
    skillLabel: `Interception — ${protector.droneName}`,
    mechanicalTotal: roll, diffLabel: `Seuil ${protector.level}`,
    chancesDeReussite: protector.level, isSuccess: outcome.isSuccess, mr: outcome.mr,
  } }
  await maybeTriggerCatastrophe(io, campaignId, protector.droneTokenId, outcome.catastropheRisk, {
    site: 'drone_interception', actorTokenId: protector.droneTokenId, targetTokenId: action.target_token_id,
  })
  return { outcome, emission }
}

// `action` : l'action de Tir (token_id = tireur, target_token_id = cible). `mr` : marge de réussite de
// l'attaque (déjà connue, jamais recalculée). `attackKind` : 'ranged' | 'melee', EXPLICITE (voir
// shared/droneInterception.js) — une finalisation partagée avec le corps à corps d'un drone ne doit jamais
// le deviner.
// Retourne { action, interposed, emissions } : `action` porte le token du drone comme nouvelle cible quand il
// s'est interposé (les chemins « cible drone » existants font le reste : dégâts, intégrité, émissions) ;
// `emissions` s'ajoutent à celles de l'appelant (ordre de chat : après le jet d'attaque, pas avant).
export async function resolveProtectorInterposition(io, campaignId, { action, mr, attackKind }) {
  try {
    return await interpose(io, campaignId, { action, mr, attackKind })
  } catch (err) {
    // Une erreur d'interposition ne doit JAMAIS faire perdre le tir : on retombe sur le comportement historique.
    console.error('[WS] resolveProtectorInterposition error:', err.message)
    return { action, interposed: null, emissions: [] }
  }
}

async function interpose(io, campaignId, { action, mr, attackKind }) {
  const unchanged = { action, interposed: null, emissions: [] }
  if (!ATTACK_KINDS.includes(attackKind)) {
    // Un appelant qui oublie de le dire ne doit pas faire perdre le tir, mais l'oubli ne doit pas passer inaperçu.
    console.warn(`[WS] interposition ignorée — attackKind absent ou inconnu : ${attackKind}`)
    return unchanged
  }
  if (attackKind !== 'ranged') return unchanged
  if (!action?.target_token_id) return unchanged

  const targetToken = await db('tokens').where({ id: action.target_token_id }).first()
  if (!targetToken?.character_id) return unchanged
  const droneCharacterIds = await listProtectorLinks(targetToken.character_id)
  if (droneCharacterIds.length === 0) return unchanged // cas courant : aucun coût, aucun bruit en chat
  console.log(`[DBG] interposition — tir touché (MR ${mr}) sur une cible protégée par ${droneCharacterIds.length} drone(s), token cible:${targetToken.id}`)

  const shooterToken = await db('tokens').where({ id: action.token_id }).first()
  if (!shooterToken || shooterToken.battlemap_id !== targetToken.battlemap_id
    || shooterToken.position_space !== 'world-feet' || targetToken.position_space !== 'world-feet') {
    return unchanged
  }
  const battlemap = await db('battlemaps').where({ id: targetToken.battlemap_id }).first()
  if (!battlemap) return unchanged

  const emissions = []
  // Compte rendu en chat de CHAQUE étape (systemNotice, ci-dessus).
  const notice = (i18nKey, params) => emissions.push(systemNotice(i18nKey, params))
  const targetName = (await db('characters').where({ id: targetToken.character_id }).select('name').first())?.name
    ?? targetToken.label ?? '?'

  const candidates = await gatherCandidates(campaignId, droneCharacterIds, { targetToken, action })
  const { screened, rejected } = screenCandidates(candidates, { attackKind })
  for (const { droneTokenId, reason } of rejected) {
    const candidate = candidates.find(c => c.droneTokenId === droneTokenId)
    console.log(`[DBG] interposition — ${candidate?.droneName ?? droneTokenId} inéligible : ${reason}`)
    // « is_target » : le drone est la cible du tir, rien à expliquer. Les autres motifs sont dits au chat.
    if (reason !== 'is_target') notice(`session.droneInterceptIneligible.${reason}`, { drone: candidate?.droneName ?? '?' })
  }
  if (screened.length === 0) {
    console.log('[DBG] interposition — aucun drone éligible, tir inchangé')
    return { ...unchanged, emissions }
  }

  // Portée : le drone doit pouvoir rejoindre, au plus court, une case que la trajectoire traverse — avec sa
  // vitesse max, chemin réel (murs, occupation) compris. Planification seule, rien n'est déplacé ici.
  const trajectory = shotTrajectory(shooterToken, targetToken)
  const destinationPredicate = createSegmentCellPredicate(trajectory.from, trajectory.to, { bodyHeight: trajectory.bodyHeight })
  for (const candidate of screened) {
    // Option B (décision Saar 2026-09-24) : le décor (entités) ne bloque pas le drone — petit et volant, il
    // se glisse entre les objets ; seuls les tokens occupent une case pour lui.
    const plan = await planBattlemapTokenMovement({
      battlemap, token: candidate.token, authorizedBudgetM: candidate.speedM, destinationPredicate,
      ignoreEntityOccupants: true,
    })
    candidate.reachable = plan.status === 'destination'
    candidate.destination = plan.snappedTo ?? null
    console.log(`[DBG] interposition — ${candidate.droneName} : portée ${plan.status}${plan.routeCostM != null ? ` (coût ${plan.routeCostM} m / budget ${candidate.speedM} m)` : ` (budget ${candidate.speedM} m)`}`)
    if (!candidate.reachable) notice('session.droneInterceptNoReach', { drone: candidate.droneName, budget: candidate.speedM })
  }

  const { protector } = pickProtector(screened, { attackKind })
  if (!protector) {
    console.log('[DBG] interposition — aucun drone ne peut rejoindre la trajectoire, tir inchangé')
    return { ...unchanged, emissions }
  }

  // Le drone TENTE l'interposition : il rejoint la trajectoire AVANT le Test, que celui-ci réussisse ou non
  // (décision Saar 2026-09-24 : une tentative est un déplacement physique). Déplacement visible, gratuit —
  // aucun compteur de mouvement par Tour dans le moteur. Un drone qui échoue reste donc sur la ligne de tir.
  const move = await executeBattlemapTokenMovement({
    battlemapId: battlemap.id, tokenId: protector.droneTokenId,
    destination: protector.destination, authorizedBudgetM: protector.speedM, ignoreEntityOccupants: true,
  })
  emitExecutedTokenMovement(io, campaignId, {
    battlemapId: battlemap.id,
    outcome: move,
    movedKind: 'drone-interposition',
    worldMovement: move?.moved
      ? { kind: 'drone-interposition', pathId: move.result.plan.pathId, spentM: move.result.plan.spentM }
      : null,
  })
  if (move?.status !== 'destination') {
    // Le monde a changé entre la planification et l'exécution (occupation, porte) : pas de tentative.
    console.warn(`[WS] interposition — ${protector.droneName} n'a pas pu rejoindre la trajectoire (${move?.status})`)
    notice('session.droneInterceptNoReach', { drone: protector.droneName, budget: protector.speedM })
    return { ...unchanged, emissions }
  }
  console.log(`[DBG] interposition — ${protector.droneName} rejoint la trajectoire${move.moved ? ` (déplacé de ${move.result.plan.spentM} m)` : ' (déjà dessus)'}`)
  if (move.moved) notice('session.droneRepositioned', { drone: protector.droneName, target: targetName, distance: move.result.plan.spentM })
  else notice('session.droneAlreadyInPlace', { drone: protector.droneName, target: targetName })

  const { outcome, emission } = await rollInterceptionTest(io, campaignId, protector, action)
  emissions.push(emission)
  const interposes = isInterposed(outcome.mr, mr)
  console.log(`[DBG] interposition — Test ${protector.droneName} : jet ${emission.data.total} Seuil ${protector.level} → ${outcome.isSuccess ? 'réussi' : 'raté'} MR ${outcome.mr} contre MR attaque ${mr} → ${interposes ? "s'interpose" : 'échoue (marge non supérieure)'}`)
  const margins = { drone: protector.droneName, target: targetName, droneMr: outcome.mr, attackMr: mr }
  if (!interposes) {
    // Deux échecs distincts, que la carte du Test rend contradictoires si le message les confond : Test RATÉ
    // (jet > Seuil, la marge est alors négative et sans intérêt) ou Test RÉUSSI mais marge non supérieure à
    // celle du tir (la carte dit « réussi », le chat doit dire pourquoi le tir passe quand même).
    if (outcome.isSuccess) notice('session.droneInterceptOutmatched', margins)
    else notice('session.droneInterceptTestFailed', { drone: protector.droneName, target: targetName, roll: emission.data.total, seuil: protector.level })
    return { ...unchanged, emissions }
  }
  notice('session.droneInterposed', margins)
  return {
    action: { ...action, target_token_id: protector.droneTokenId },
    interposed: { droneTokenId: protector.droneTokenId, droneCharacterId: protector.droneCharacterId },
    emissions,
  }
}
