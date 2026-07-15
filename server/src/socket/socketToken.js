import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { checkTokenOwnership } from '../lib/socketUtils.js'
import * as statusService from '../lib/statusService.js'
import { getCharacterMovementBudget } from '../services/movementBudgetService.js'
import { executeBattlemapTokenMovement } from '../services/worldMovementService.js'

export function registerTokenHandlers(io, socket, { campaignId, user, isGm }) {
  // ─── TOKEN:MOVE ────────────────────────────────────────────────────────
  // Déplacement de jeu : le client fournit une intention, jamais des coordonnées finales.
  // Payload : { tokenId, destination: {x,y,z}, gait }
  socket.on(WS.TOKEN_MOVE, async ({ tokenId, destination, gait = 'moyenne' }) => {
    try {
      if (!destination) {
        socket.emit(WS.TOKEN_MOVE_REJECTED, {
          tokenId,
          code: 'legacy-direct-move-disabled',
          message: 'Direct coordinates are no longer accepted; send a world destination and gait',
        })
        return
      }
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) {
        socket.emit(WS.TOKEN_MOVE_REJECTED, { tokenId, code: 'token-not-found' })
        return
      }
      const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
      if (!battlemap || battlemap.campaign_id !== campaignId) {
        socket.emit(WS.TOKEN_MOVE_REJECTED, { tokenId, code: 'wrong-campaign' })
        return
      }

      // Vérifier les droits : GM ou propriétaire du character lié au token
      const { isOwner } = await checkTokenOwnership(db, token, user.id, isGm ? 'gm' : 'player')
      if (!isOwner && !isGm) {
        socket.emit(WS.TOKEN_MOVE_REJECTED, { tokenId, code: 'access-denied' })
        return
      }
      if (!token.character_id || token.position_space !== 'world-feet') {
        socket.emit(WS.TOKEN_MOVE_REJECTED, { tokenId, code: 'world-position-required' })
        return
      }

      const budget = await getCharacterMovementBudget(token.character_id, gait)
      const outcome = await executeBattlemapTokenMovement({
        battlemapId: token.battlemap_id,
        tokenId,
        destination,
        authorizedBudgetM: budget.budgetM,
      })
      if (!outcome.moved) {
        socket.emit(WS.TOKEN_MOVE_REJECTED, {
          tokenId,
          code: outcome.status,
          result: outcome.result || null,
        })
        return
      }

      // Broadcaster à tous les membres de la campagne (y compris l'émetteur)
      io.to(campaignId).emit(WS.TOKEN_MOVED, {
        tokenId: outcome.token.id,
        pos_x: outcome.token.pos_x,
        pos_y: outcome.token.pos_y,
        pos_z: outcome.token.pos_z,
        position_space: outcome.token.position_space,
        updated_at: outcome.token.updated_at,
        worldMovement: {
          pathId: outcome.result.plan.pathId,
          worldRevision: outcome.result.worldRevision,
          runtimeRevision: outcome.runtimeRevision,
          gait: budget.gait,
          budgetM: budget.budgetM,
          spentM: outcome.result.plan.spentM,
          stopReason: outcome.result.plan.stopReason,
        },
      })
    } catch (err) {
      console.error('[WS] token:move error:', err.message)
      socket.emit(WS.TOKEN_MOVE_REJECTED, {
        tokenId,
        code: 'movement-error',
        message: err.message,
      })
    }
  })

  // ─── TOKEN:ROTATE ──────────────────────────────────────────────────────
  // Joueur ou GM fait pivoter son token de 45° (incrément r = (r+1) % 8)
  // Payload : { tokenId }
  // Le serveur est source de vérité pour l'incrément — le client n'envoie pas r.
  // PE21 : rotation.y = r * Math.PI / 4 côté client
  socket.on(WS.TOKEN_ROTATE, async ({ tokenId }) => {
    try {
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return

      // Ownership : GM ou propriétaire du character lié au token
      const { isOwner } = await checkTokenOwnership(db, token, user.id, isGm ? 'gm' : 'player')
      if (!isOwner && !isGm) return

      // Incrément 45° modulo 8 — r = 0..7
      const newR = ((token.r ?? 0) + 1) % 8

      const [updated] = await db('tokens')
        .where({ id: tokenId })
        .update({ r: newR, updated_at: db.fn.now() })
        .returning('*')

      // Broadcast TOKEN_UPDATED — réutilise l'event existant
      io.to(campaignId).emit(WS.TOKEN_UPDATED, { token: updated })
    } catch (err) {
      console.error('[WS] token:rotate error:', err.message)
    }
  })

  // Joueur ou GM oriente son token vers une direction absolue (r = 0..7)
  // Payload : { tokenId, r } — r validé serveur, jamais fait confiance au client
  socket.on(WS.TOKEN_SET_ROTATION, async ({ tokenId, r }) => {
    try {
      if (!Number.isInteger(r) || r < 0 || r > 7) return

      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return

      const { isOwner } = await checkTokenOwnership(db, token, user.id, isGm ? 'gm' : 'player')
      if (!isOwner && !isGm) return

      const [updated] = await db('tokens')
        .where({ id: tokenId })
        .update({ r, updated_at: db.fn.now() })
        .returning('*')

      io.to(campaignId).emit(WS.TOKEN_UPDATED, { token: updated })
    } catch (err) {
      console.error('[WS] token:set_rotation error:', err.message)
    }
  })

  // ─── TOKEN:STATUS_TOGGLE ───────────────────────────────────────────────
  // GM ou propriétaire du token : ajoute ou retire un statut (toggle)
  // Payload : { tokenId, statusCode }
  socket.on(WS.TOKEN_STATUS_TOGGLE, async ({ tokenId, statusCode }) => {
    try {
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return

      const { isOwner } = await checkTokenOwnership(db, token, user.id, isGm ? 'gm' : 'player')
      if (!isOwner && !isGm) return

      const VALID_STATUS_CODES = new Set([
        'grappled', 'restrained', 'off_balance',
        'burning', 'acid', 'asphyxia', 'decompression', 'electrocuted',
        'stunned', 'unconscious', 'blinded',
        'hypothermia', 'infected', 'poisoned', 'irradiated',
      ])
      if (!VALID_STATUS_CODES.has(statusCode)) return

      const existing = await db('token_statuses')
        .where({ token_id: tokenId, status_code: statusCode })
        .first()

      if (existing) {
        await db('token_statuses').where({ id: existing.id }).delete()
      } else {
        await db('token_statuses').insert({
          token_id: tokenId,
          status_code: statusCode,
          applied_by: user.id,
        })
      }

      await statusService.emitTokenStatusUpdated(io, db, campaignId, tokenId)
    } catch (err) {
      console.error('[WS] token:status_toggle error:', err.message)
    }
  })
}
