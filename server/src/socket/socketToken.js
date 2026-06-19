import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { checkTokenOwnership } from '../lib/socketUtils.js'
import { collisionMoveToken } from '../lib/redis.js'
import * as statusService from '../lib/statusService.js'

export function registerTokenHandlers(io, socket, { campaignId, user, isGm }) {
  // ─── TOKEN:MOVE ────────────────────────────────────────────────────────
  // Un joueur ou GM déplace un token
  // Payload : { tokenId, pos_x, pos_y, pos_z }
  socket.on(WS.TOKEN_MOVE, async ({ tokenId, pos_x, pos_y, pos_z }) => {
    try {
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return

      // Vérifier les droits : GM ou propriétaire du character lié au token
      const { isOwner } = await checkTokenOwnership(db, token, user.id, isGm ? 'gm' : 'player')
      if (!isOwner && !isGm) {
        socket.emit('error', { message: 'Access denied' })
        return
      }

      // Mettre à jour en base — updated_at inclus pour cohérence avec les routes REST
      const [updated] = await db('tokens')
        .where({ id: tokenId })
        .update({ pos_x, pos_y, pos_z, updated_at: db.fn.now() })
        .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'layer', 'updated_at'])

      // Maintenance collision map Redis — hdel ancienne case + hset nouvelle
      await collisionMoveToken(token.battlemap_id, token, updated)

      // Broadcaster à tous les membres de la campagne (y compris l'émetteur)
      io.to(campaignId).emit(WS.TOKEN_MOVED, {
        tokenId: updated.id,
        pos_x: updated.pos_x,
        pos_y: updated.pos_y,
        pos_z: updated.pos_z,
        updated_at: updated.updated_at,
      })
    } catch (err) {
      console.error('[WS] token:move error:', err.message)
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
