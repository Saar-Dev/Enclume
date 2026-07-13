import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { bumpBattlemapRuntimeRevision } from '../services/worldRuntimeService.js'

// Suppression atomique d'un lot de tokens : DB + notification socket.
// Le moteur monde relit l'occupation dynamique depuis PostgreSQL.
export async function removeTokens(io, tokens, campaignId) {
  const ids = tokens.map((t) => t.id)
  if (ids.length) {
    await db('tokens').whereIn('id', ids).delete()
    for (const battlemapId of new Set(tokens.map(token => token.battlemap_id).filter(Boolean))) {
      const runtimeRevision = await bumpBattlemapRuntimeRevision(battlemapId)
      io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
        battlemapId,
        runtimeRevision,
        kind: 'token-deleted',
      })
    }
  }

  for (const token of tokens) {
    io.to(campaignId).emit(WS.TOKEN_DELETED, { tokenId: token.id })
  }
}
