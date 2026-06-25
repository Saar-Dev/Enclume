import { RateLimiterMemory } from 'rate-limiter-flexible'
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { acceptTransfer } from '../services/tradeService.js'

const tradeOfferLimiter = new RateLimiterMemory({ points: 3, duration: 60 })

async function findSocketByCharId(io, campaignId, charId) {
  const char = await db('characters').where({ id: charId }).select('user_id').first()
  if (!char) return null
  const sockets = await io.in(campaignId).fetchSockets()
  return sockets.find(s => s.data.userId === char.user_id) ?? null
}

async function findGmSocket(io, campaignId) {
  const sockets = await io.in(campaignId).fetchSockets()
  return sockets.find(s => s.data.role === 'gm') ?? null
}

export function registerTradeHandlers(io, socket, context) {
  const { campaignId, user } = context

  // PJ A → propose une offre à PJ B
  socket.on(WS.TRADE_TRANSFER_OFFER, async ({ fromCharId, toCharId, items = [], solsOffer = 0 }) => {
    try {
      await tradeOfferLimiter.consume(user.id)
    } catch {
      socket.emit(WS.TRADE_ERROR, { code: 'RATE_LIMITED', retryAfter: 60 })
      return
    }
    try {
      // Vérifier que fromCharId appartient bien à cet utilisateur dans cette campagne
      const fromChar = await db('characters')
        .join('tokens', 'tokens.character_id', 'characters.id')
        .where({ 'tokens.campaign_id': campaignId, 'characters.id': fromCharId, 'characters.user_id': user.id })
        .select('characters.id', 'characters.name')
        .first()
      if (!fromChar) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND', message: 'Personnage introuvable' })
        return
      }

      const campaign = await db('campaigns').where({ id: campaignId }).select('tour_duration').first()
      const duration = campaign?.tour_duration ?? 120
      const expiresAt = new Date(Date.now() + duration * 1000)

      const [offer] = await db('trade_offers').insert({
        campaign_id:  campaignId,
        from_char_id: fromChar.id,
        to_char_id:   toCharId,
        items_json:   JSON.stringify(items),
        sols_offer:   solsOffer,
        expires_at:   expiresAt,
        created_at:   new Date(),
      }).returning('*')

      const targetSocket = await findSocketByCharId(io, campaignId, toCharId)
      if (targetSocket) {
        targetSocket.emit(WS.TRADE_OFFER_RECEIVED, {
          offerId:      offer.id,
          fromCharName: fromChar.name,
          items,
          solsOffer,
          expiresAt:    offer.expires_at,
        })
      }
    } catch (err) {
      console.error('[TRADE] TRANSFER_OFFER error:', err.message)
      socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
    }
  })

  // PJ B → accepte l'offre (transaction atomique)
  socket.on(WS.TRADE_TRANSFER_ACCEPTED, async ({ offerId, acceptingCharId }) => {
    try {
      // Vérifier que acceptingCharId appartient bien à cet utilisateur dans cette campagne
      const acceptingChar = await db('characters')
        .join('tokens', 'tokens.character_id', 'characters.id')
        .where({ 'tokens.campaign_id': campaignId, 'characters.id': acceptingCharId, 'characters.user_id': user.id })
        .select('characters.id')
        .first()
      if (!acceptingChar) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }

      const logEntry = await acceptTransfer(campaignId, { offerId, acceptingCharId: acceptingChar.id })

      const offer = await db('trade_offers').where({ id: offerId }).first()
      const [socketA, socketB] = await Promise.all([
        findSocketByCharId(io, campaignId, offer.from_char_id),
        findSocketByCharId(io, campaignId, offer.to_char_id),
      ])
      if (socketA) socketA.emit(WS.TRADE_OFFER_ACCEPTED, { offerId })
      if (socketB) socketB.emit(WS.TRADE_OFFER_ACCEPTED, { offerId })

      const gmSocket = await findGmSocket(io, campaignId)
      if (gmSocket) gmSocket.emit(WS.TRADE_LOG_UPDATED, { entry: logEntry })
    } catch (err) {
      const knownCodes = ['OFFER_NOT_FOUND', 'OFFER_EXPIRED', 'INSUFFICIENT_FUNDS', 'ITEM_UNAVAILABLE']
      if (knownCodes.includes(err.message)) {
        socket.emit(WS.TRADE_ERROR, { code: err.message })
      } else {
        console.error('[TRADE] TRANSFER_ACCEPTED error:', err.message)
        socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
      }
    }
  })

  // PJ B → refuse l'offre
  socket.on(WS.TRADE_TRANSFER_DECLINED, async ({ offerId }) => {
    try {
      const offer = await db('trade_offers')
        .where({ id: offerId, campaign_id: campaignId, status: 'PENDING' })
        .first()
      if (!offer) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }
      await db('trade_offers').where({ id: offerId }).update({ status: 'DECLINED', updated_at: new Date() })

      const socketA = await findSocketByCharId(io, campaignId, offer.from_char_id)
      if (socketA) socketA.emit(WS.TRADE_OFFER_DECLINED, { offerId })
    } catch (err) {
      console.error('[TRADE] TRANSFER_DECLINED error:', err.message)
      socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
    }
  })

  // PJ A → annule l'offre avant acceptation
  socket.on(WS.TRADE_TRANSFER_CANCELLED, async ({ offerId, fromCharId }) => {
    try {
      // Vérifier que fromCharId appartient bien à cet utilisateur
      const cancellingChar = await db('characters')
        .join('tokens', 'tokens.character_id', 'characters.id')
        .where({ 'tokens.campaign_id': campaignId, 'characters.id': fromCharId, 'characters.user_id': user.id })
        .select('characters.id')
        .first()
      if (!cancellingChar) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }

      const offer = await db('trade_offers')
        .where({ id: offerId, campaign_id: campaignId, status: 'PENDING', from_char_id: cancellingChar.id })
        .first()
      if (!offer) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }
      await db('trade_offers').where({ id: offerId }).update({ status: 'CANCELLED', updated_at: new Date() })

      const socketB = await findSocketByCharId(io, campaignId, offer.to_char_id)
      if (socketB) socketB.emit(WS.TRADE_OFFER_CANCELLED, { offerId })
    } catch (err) {
      console.error('[TRADE] TRANSFER_CANCELLED error:', err.message)
      socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
    }
  })
}
