import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { collisionRemoveToken } from './redis.js'

// Suppression atomique d'un lot de tokens : nettoyage Redis + DB + notification socket.
// Point unique pour tout appelant qui supprime des tokens en cascade (character, battlemap...) —
// évite la duplication ad hoc du triplet Redis/DB/socket à chaque nouveau point de suppression.
export async function removeTokens(io, tokens, campaignId) {
  for (const token of tokens) {
    await collisionRemoveToken(token.battlemap_id, token)
  }

  const ids = tokens.map((t) => t.id)
  if (ids.length) {
    await db('tokens').whereIn('id', ids).delete()
  }

  for (const token of tokens) {
    io.to(campaignId).emit(WS.TOKEN_DELETED, { tokenId: token.id })
  }
}
