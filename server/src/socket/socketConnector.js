// server/src/socket/socketConnector.js
//
// Interaction joueur/MJ avec une porte en session (docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md).
// Patron d'arbitrage MJ mirroré depuis `socketEntity.js` (ENTITY_ACTION_REQUEST/RESOLVE) — le Test
// lui-même est résolu par le service partagé `gmArbitratedTestService.js`, jamais dupliqué (§7
// point 4 du plan : cette mécanique est RAW générique, aucune dépendance à une entité).

import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { isTestBlockingWound } from '../../../shared/woundConstants.js'
import { loadBattlemapDoorConnector, measureBattlemapTokenConnectorDistance } from '../services/worldSpatialQueryService.js'
import { setWorldFeatureState } from '../services/worldEffectService.js'
import { resolveGmArbitratedTest } from '../services/gmArbitratedTestService.js'
import { resolveDoorActionOutcome } from '../../../shared/world/connectorActions.js'

const DEFAULT_INTERACTION_RANGE_M = 1.5

// ref_skills.id est une clé métier stable (ex. "SYSTEMES_DE_SECURITE"), pas une UUID générée par un
// seed — vérifié dans 283_ref_skills_seed.js. La référencer en dur ici est donc conforme à
// `.claude/rules/core.md` (jamais l'id d'une ligne seedée... sauf quand cet id EST la clé métier).
const LOCK_TEST_SKILL_ID = 'SYSTEMES_DE_SECURITE'

// Malus appliqué quand le MJ n'a pas renseigné `lockDifficultyDc` sur la porte (décision Saar
// 2026-09-01, PLAN_INTERACTIONS_CONNECTEURS.md §1/§6) — jamais un bonus, jamais un jet fabriqué sur
// une valeur vraiment inconnue (contrairement au cas Chance de l'AOE, cette Difficulté est une donnée
// normalement autorée qui peut juste manquer par oubli).
const LOCK_TEST_FALLBACK_DIFFICULTY = -5

const ACTION_TO_STATE = Object.freeze({ open: 'open', close: 'closed', lock: 'locked' })

export function registerConnectorHandlers(io, socket, { campaignId, user, isGm }, pendingConnectorActions) {
  // ─── CONNECTOR:ACTION_REQUEST ──────────────────────────────────────────
  // Payload : { requestId, characterId, connectorId, battlemapId, action }
  // connectorId = connector.worldId (§4 du plan) — jamais une clé d'objet legacy.
  // action ∈ 'open' | 'close' pour un joueur ; le MJ peut en plus envoyer 'lock' (§4 point 0).
  socket.on(WS.CONNECTOR_ACTION_REQUEST, async ({ requestId, characterId, connectorId, battlemapId, action }) => {
    try {
      if (!campaignId) return
      if (!requestId || !connectorId || !battlemapId) return

      // ── Override MJ (§4 point 0, décision Saar 2026-09-01 : "le MJ doit toujours pouvoir
      // intervenir") — ignore characterId, portée et Test, mirroir exact de ENTITY_ACTION_GM_DIRECT
      // (socketEntity.js:396-405) : tout clic MJ sur un objet du monde via cette interface générique
      // est instantané, sans arbitrage — jamais de chemin PNJ-piloté-avec-Test à travers ce clic (les
      // Tests de PNJ passent par les fenêtres de combat dédiées). `isGm` seul suffit, comme pour
      // l'entité — pas de champ `gmOverride` distinct (retiré, analyse 2026-09-02 : la première
      // version distinguait isGm seul de isGm+gmOverride pour protéger un chemin PNJ-Test qui
      // n'existe nulle part dans ce projet pour ce type d'interaction). Le verrou de ligne + version
      // de setWorldFeatureState protège toujours contre une course avec une écriture joueur
      // concurrente — aucune garantie perdue par ce court-circuit.
      if (isGm) {
        if (!ACTION_TO_STATE[action]) return
        const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
        if (!battlemap) return
        const connector = loadBattlemapDoorConnector(battlemap, connectorId)
        if (!connector) {
          socket.emit('error', { message: 'Connecteur introuvable' })
          return
        }
        const result = await setWorldFeatureState({
          battlemapId,
          featureId: connector.worldId,
          state: { state: ACTION_TO_STATE[action] },
          userId: user.id,
        })
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: true })
        io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
          battlemapId, runtimeRevision: result.runtimeRevision, kind: 'door-state',
        })
        console.log(`[WS] connector:action_request override MJ — ${user.username} → ${action}`)
        return
      }

      // ── Flux joueur ────────────────────────────────────────────────────
      if (action !== 'open' && action !== 'close') return // 'lock' réservé au MJ ci-dessus
      if (!characterId) return

      // Validation 1 — le character appartient bien au joueur émetteur (mirroir socketEntity.js:68-72)
      const character = await db('characters').where({ id: characterId }).first()
      if (!character || character.user_id !== user.id) {
        socket.emit('error', { message: 'Character non autorisé' })
        return
      }

      // Portée + existence du connecteur en un seul appel autoritaire (§2/§4 point 1-2) —
      // measureBattlemapTokenConnectorDistance rejette déjà un connectorId qui n'est pas une porte
      // existante (status 'connector-not-found'), jamais un 2e chargement redondant ici.
      const actorToken = await db('tokens')
        .where({ character_id: characterId, battlemap_id: battlemapId })
        .first()
      const measurement = actorToken
        ? await measureBattlemapTokenConnectorDistance({ tokenId: actorToken.id, connectorId, battlemapId })
        : { status: 'no-token' }

      if (measurement.status === 'connector-not-found') {
        socket.emit('error', { message: 'Connecteur introuvable' })
        return
      }
      if (measurement.status !== 'ok' || measurement.distanceM > DEFAULT_INTERACTION_RANGE_M) {
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: false, reason: 'out_of_range' })
        return
      }
      const { connector, featureStates } = measurement

      // État effectif — runtime prioritaire sur le statique (§3), jamais l'inverse. featureStates
      // vient de measureBattlemapTokenConnectorDistance (déjà chargé pour le snapshot de distance),
      // jamais un 2e appel DB pour la même donnée (analyse critique 2026-09-02).
      const effectiveState = featureStates[connector.worldId]?.state || connector.state || 'closed'

      // Décision pure (§4 points 4-6), testée en isolation — connectorActions.test.mjs.
      const outcome = resolveDoorActionOutcome(action, effectiveState)

      // No-op légitime (§4 point 4) — rien à faire, pas une erreur.
      if (outcome === 'noop') {
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: true })
        return
      }

      // Branche libre (§4 point 5) — ouvrir une porte fermée, ou fermer une porte ouverte.
      if (outcome === 'free') {
        const result = await setWorldFeatureState({
          battlemapId,
          featureId: connector.worldId,
          state: { state: ACTION_TO_STATE[action] },
          userId: user.id,
        })
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: true })
        io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
          battlemapId, runtimeRevision: result.runtimeRevision, kind: 'door-state',
        })
        return
      }

      // outcome === 'test' seul cas restant possible : action déjà validée à 'open'/'close' plus
      // haut, donc la seule combinaison qui n'est ni 'noop' ni 'free' est action==='open' sur une
      // porte 'locked' (§4 point 6) — garde défensive au cas où la matrice évoluerait sans que ce
      // site soit relu.
      if (outcome !== 'test') return

      // WNDMORT-HORSCOMBAT (mirroir socketEntity.js:122-132) — posé avant l'arbitrage MJ, pas après,
      // pour ne pas faire perdre son temps au MJ sur une tentative déjà impossible.
      const sheetMortal = await db('char_sheet').where({ character_id: characterId }).first()
      const woundsMortal = sheetMortal
        ? await db('character_wounds').where({ char_sheet_id: sheetMortal.id })
        : []
      if (isTestBlockingWound(woundsMortal)) {
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: false, reason: 'mortally_wounded' })
        return
      }

      // Trouver le socket GM via socket.data.role (mirroir socketEntity.js:134-136)
      const roomSockets = await io.in(campaignId).fetchSockets()
      const gmSocket = roomSockets.find(s => s.data.role === 'gm')
      if (!gmSocket) {
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: false, reason: 'no_gm' })
        return
      }

      const defaultDifficulty = connector.lockDifficultyDc ?? LOCK_TEST_FALLBACK_DIFFICULTY

      // Timeout 60s — même patron que ENTITY_ACTION_REQUEST (PE12).
      const timeoutHandle = setTimeout(() => {
        pendingConnectorActions.delete(requestId)
        socket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: false, reason: 'timeout' })
        console.log(`[WS] connector:action timeout — requestId: ${requestId}`)
      }, 60000)

      pendingConnectorActions.set(requestId, {
        timeoutHandle,
        playerSocketId: socket.id,
        playerUserId: user.id,
        playerName: user.username,
        characterId,
        characterName: character.name,
        connectorId: connector.worldId,
        connectorLabel: connector.modelLabel || null,
        battlemapId,
        campaignId,
        skillId: LOCK_TEST_SKILL_ID,
        defaultDifficulty,
      })

      gmSocket.emit(WS.CONNECTOR_ACTION_PENDING, {
        requestId,
        playerName: user.username,
        characterName: character.name,
        connectorLabel: connector.modelLabel || null,
        skillId: LOCK_TEST_SKILL_ID,
        defaultDifficulty,
      })

      console.log(`[WS] connector:action_request — ${user.username} → crocheter porte`)
    } catch (err) {
      console.error('[WS] connector:action_request error:', err.message)
    }
  })

  // ─── CONNECTOR:ACTION_RESOLVE ──────────────────────────────────────────
  // Le GM prend une décision sur une demande de crochetage.
  // Payload : { requestId, isApproved, autoSuccess, gmModifier }
  socket.on(WS.CONNECTOR_ACTION_RESOLVE, async ({ requestId, isApproved, autoSuccess, gmModifier = 0 }) => {
    try {
      if (!isGm) return
      if (!requestId) return

      const pending = pendingConnectorActions.get(requestId)
      if (!pending) return

      clearTimeout(pending.timeoutHandle)
      pendingConnectorActions.delete(requestId)

      const roomSockets = await io.in(pending.campaignId).fetchSockets()
      const playerSocket = roomSockets.find(s => s.id === pending.playerSocketId)

      // ── Refus ──────────────────────────────────────────────────────────
      if (!isApproved) {
        if (playerSocket) {
          playerSocket.emit(WS.CONNECTOR_ACTION_RESULT, { requestId, isApproved: false, reason: 'refused' })
        }
        return
      }

      // Résolution du Test (jet réel ou succès auto) — service partagé avec ENTITY_ACTION_RESOLVE,
      // jamais dupliqué (docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md §7 point 4).
      const testOutcome = await resolveGmArbitratedTest({
        io,
        campaignId: pending.campaignId,
        characterId: pending.characterId,
        playerUserId: pending.playerUserId,
        playerName: pending.playerName,
        skillId: pending.skillId,
        attributeId: null,
        defaultDifficulty: pending.defaultDifficulty,
        gmModifier,
        autoSuccess,
        dicePayloadType: 'connector_action',
        catastropheSite: 'connector_action',
      })

      // Succès → la porte s'ouvre (RAW : pas d'état intermédiaire "déverrouillée", §4 point 6).
      // Aucun CONNECTOR_ACTION_RESULT supplémentaire ici, par cohérence avec ENTITY_ACTION_RESOLVE :
      // le joueur apprend le résultat via DICE_RESULT (déjà émis par le service) et la porte qui
      // s'ouvre réellement (WORLD_RUNTIME_UPDATED) — jamais un 2e message de résultat redondant.
      if (testOutcome?.isSuccess) {
        const result = await setWorldFeatureState({
          battlemapId: pending.battlemapId,
          featureId: pending.connectorId,
          state: { state: 'open' },
          userId: pending.playerUserId,
        })
        io.to(pending.campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
          battlemapId: pending.battlemapId, runtimeRevision: result.runtimeRevision, kind: 'door-state',
        })
      }
    } catch (err) {
      console.error('[WS] connector:action_resolve error:', err.message)
    }
  })
}
