import { RateLimiterMemory } from 'rate-limiter-flexible'
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { acceptTransfer, executeSell } from '../services/tradeService.js'

// Calcule le prix catalogue d'un item pour un marchand donné (mod_global uniquement)
function computeCatalogPrice(refPrice, modGlobal) {
  return Math.round((refPrice ?? 0) * (1 + (modGlobal ?? 0) / 100))
}

const tradeOfferLimiter = new RateLimiterMemory({ points: 3, duration: 60 })
const SELL_OFFER_TTL_SEC = 120

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
  socket.on(WS.TRADE_TRANSFER_OFFER, async ({ fromCharId, toCharId, items = [], solsOffer = 0 }, callback) => {
    try {
      await tradeOfferLimiter.consume(user.id)
    } catch {
      socket.emit(WS.TRADE_ERROR, { code: 'RATE_LIMITED', retryAfter: 60 })
      return
    }
    try {
      // Vérifier que fromCharId appartient bien à cet utilisateur dans cette campagne
      const fromChar = await db('characters')
        .where({ campaign_id: campaignId, id: fromCharId, user_id: user.id })
        .select('id', 'name')
        .first()
      if (!fromChar) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND', message: 'Personnage introuvable' })
        return
      }

      const expiresAt = new Date(Date.now() + SELL_OFFER_TTL_SEC * 1000)

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
      if (typeof callback === 'function') callback({ ok: true, offerId: offer.id, expiresAt: offer.expires_at })
    } catch (err) {
      console.error('[TRADE] TRANSFER_OFFER error:', err.message)
      socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
      if (typeof callback === 'function') callback({ ok: false })
    }
  })

  // PJ B → accepte l'offre (transaction atomique)
  socket.on(WS.TRADE_TRANSFER_ACCEPTED, async ({ offerId, acceptingCharId }) => {
    try {
      // Vérifier que acceptingCharId appartient bien à cet utilisateur dans cette campagne
      const acceptingChar = await db('characters')
        .where({ campaign_id: campaignId, id: acceptingCharId, user_id: user.id })
        .select('id')
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

  // PJ → proposer une revente d'items au GM via un marchand
  socket.on(WS.TRADE_SELL_PROPOSED, async ({ fromCharId, merchantId, items = [], solsProposed = 0 }, callback) => {
    try {
      await tradeOfferLimiter.consume(user.id)
    } catch {
      socket.emit(WS.TRADE_ERROR, { code: 'RATE_LIMITED', retryAfter: 60 })
      return
    }
    try {
      const fromChar = await db('characters')
        .where({ campaign_id: campaignId, id: fromCharId, user_id: user.id })
        .select('id', 'name')
        .first()
      if (!fromChar) {
        if (typeof callback === 'function') callback({ ok: false, code: 'CHAR_NOT_FOUND' })
        return
      }

      const merchant = merchantId
        ? await db('merchants').where({ id: merchantId, campaign_id: campaignId }).select('id', 'name', 'mod_global').first()
        : null

      // Valider ownership + enrichir chaque item avec ref_price et catalog_price
      const enrichedItems = []
      for (const item of items) {
        const row = await db('char_inventory')
          .where({ 'char_inventory.id': item.char_inventory_id, 'char_inventory.character_id': fromChar.id })
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .select('ref_equipment.price as ref_price')
          .first()
        if (!row) {
          if (typeof callback === 'function') callback({ ok: false, code: 'ITEM_UNAVAILABLE' })
          return
        }
        const refPrice = row.ref_price ?? 0
        enrichedItems.push({
          char_inventory_id: item.char_inventory_id,
          name:              item.name,
          qty:               item.qty ?? 1,
          ref_price:         refPrice,
          catalog_price:     computeCatalogPrice(refPrice, merchant?.mod_global),
        })
      }

      const expiresAt = new Date(Date.now() + SELL_OFFER_TTL_SEC * 1000)

      const [offer] = await db('trade_offers').insert({
        campaign_id:  campaignId,
        type:         'SELL',
        from_char_id: fromChar.id,
        to_char_id:   null,
        merchant_id:  merchant?.id ?? null,
        items_json:   JSON.stringify(enrichedItems),
        sols_offer:   solsProposed,
        expires_at:   expiresAt,
        created_at:   new Date(),
      }).returning('*')

      const gmSocket = await findGmSocket(io, campaignId)
      if (gmSocket) {
        gmSocket.emit(WS.TRADE_SELL_REQUEST, {
          offerId:      offer.id,
          fromCharId:   fromChar.id,
          fromCharName: fromChar.name,
          merchantName: merchant?.name ?? null,
          items:        enrichedItems,
          solsProposed,
          expiresAt:    offer.expires_at,
        })
      }
      if (typeof callback === 'function') callback({ ok: true, offerId: offer.id, expiresAt: offer.expires_at })
    } catch (err) {
      console.error('[TRADE] SELL_PROPOSED error:', err.message)
      if (typeof callback === 'function') callback({ ok: false })
    }
  })

  // GM → accepter la revente (solsFinal peut différer de solsProposed)
  socket.on(WS.TRADE_SELL_ACCEPTED, async ({ offerId, solsFinal = 0 }) => {
    if (socket.data.role !== 'gm') return
    try {
      const logEntry = await executeSell(campaignId, { offerId, solsFinal })
      const offer = await db('trade_offers').where({ id: offerId }).first()
      const pjSocket = await findSocketByCharId(io, campaignId, offer.from_char_id)
      if (pjSocket) pjSocket.emit(WS.TRADE_SELL_RESULT, { accepted: true, sols: solsFinal })
      const gmSock = await findGmSocket(io, campaignId)
      if (gmSock) gmSock.emit(WS.TRADE_LOG_UPDATED, { entry: logEntry })
    } catch (err) {
      const knownCodes = ['OFFER_NOT_FOUND', 'OFFER_EXPIRED', 'ITEM_UNAVAILABLE']
      if (knownCodes.includes(err.message)) {
        socket.emit(WS.TRADE_ERROR, { code: err.message })
      } else {
        console.error('[TRADE] SELL_ACCEPTED error:', err.message)
        socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
      }
    }
  })

  // GM → contre-offre (change le statut en COUNTER_OFFERED et stocke counter_sols en DB)
  socket.on(WS.TRADE_SELL_COUNTER, async ({ offerId, counterSols = 0 }, callback) => {
    if (socket.data.role !== 'gm') return
    try {
      const offer = await db('trade_offers')
        .where({ id: offerId, campaign_id: campaignId, type: 'SELL', status: 'PENDING' })
        .first()
      if (!offer) {
        if (typeof callback === 'function') callback({ ok: false, code: 'OFFER_NOT_FOUND' })
        return
      }
      if (new Date(offer.expires_at) < new Date()) {
        if (typeof callback === 'function') callback({ ok: false, code: 'OFFER_EXPIRED' })
        return
      }
      await db('trade_offers').where({ id: offerId }).update({
        status:       'COUNTER_OFFERED',
        counter_sols: counterSols,
        updated_at:   new Date(),
      })
      const merchant = offer.merchant_id
        ? await db('merchants').where({ id: offer.merchant_id }).select('name').first()
        : null
      const pjSocket = await findSocketByCharId(io, campaignId, offer.from_char_id)
      if (pjSocket) {
        pjSocket.emit(WS.TRADE_SELL_COUNTER_RECEIVED, {
          offerId,
          counterSols,
          merchantName: merchant?.name ?? null,
        })
      }
      if (typeof callback === 'function') callback({ ok: true })
    } catch (err) {
      console.error('[TRADE] SELL_COUNTER error:', err.message)
      if (typeof callback === 'function') callback({ ok: false })
    }
  })

  // PJ → accepter la contre-offre du GM
  socket.on(WS.TRADE_SELL_COUNTER_ACCEPTED, async ({ fromCharId, offerId }) => {
    try {
      const fromChar = await db('characters')
        .where({ campaign_id: campaignId, id: fromCharId, user_id: user.id })
        .select('id').first()
      if (!fromChar) {
        socket.emit(WS.TRADE_ERROR, { code: 'CHAR_NOT_FOUND' })
        return
      }
      // Lire counter_sols depuis DB — ne pas faire confiance au client
      const offer = await db('trade_offers')
        .where({ id: offerId, campaign_id: campaignId, type: 'SELL', status: 'COUNTER_OFFERED', from_char_id: fromChar.id })
        .select('counter_sols')
        .first()
      if (!offer) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }
      const solsFinal = offer.counter_sols ?? 0
      const logEntry = await executeSell(campaignId, { offerId, solsFinal })
      socket.emit(WS.TRADE_SELL_RESULT, { accepted: true, sols: solsFinal })
      const gmSocket = await findGmSocket(io, campaignId)
      if (gmSocket) gmSocket.emit(WS.TRADE_LOG_UPDATED, { entry: logEntry })
    } catch (err) {
      const knownCodes = ['OFFER_NOT_FOUND', 'OFFER_EXPIRED', 'ITEM_UNAVAILABLE']
      if (knownCodes.includes(err.message)) {
        socket.emit(WS.TRADE_ERROR, { code: err.message })
      } else {
        console.error('[TRADE] SELL_COUNTER_ACCEPTED error:', err.message)
        socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
      }
    }
  })

  // PJ → refuser la contre-offre du GM
  socket.on(WS.TRADE_SELL_COUNTER_DECLINED, async ({ fromCharId, offerId }) => {
    try {
      const fromChar = await db('characters')
        .where({ campaign_id: campaignId, id: fromCharId, user_id: user.id })
        .select('id').first()
      if (!fromChar) {
        socket.emit(WS.TRADE_ERROR, { code: 'CHAR_NOT_FOUND' })
        return
      }
      const offer = await db('trade_offers')
        .where({ id: offerId, campaign_id: campaignId, type: 'SELL', status: 'COUNTER_OFFERED', from_char_id: fromChar.id })
        .first()
      if (!offer) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }
      await db('trade_offers').where({ id: offerId }).update({ status: 'DECLINED', updated_at: new Date() })
      socket.emit(WS.TRADE_SELL_RESULT, { accepted: false })
    } catch (err) {
      console.error('[TRADE] SELL_COUNTER_DECLINED error:', err.message)
      socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
    }
  })

  // GM → refuser la revente
  socket.on(WS.TRADE_SELL_DECLINED, async ({ offerId }) => {
    if (socket.data.role !== 'gm') return
    try {
      const offer = await db('trade_offers')
        .where({ id: offerId, campaign_id: campaignId, type: 'SELL', status: 'PENDING' })
        .first()
      if (!offer) {
        socket.emit(WS.TRADE_ERROR, { code: 'OFFER_NOT_FOUND' })
        return
      }
      await db('trade_offers').where({ id: offerId }).update({ status: 'DECLINED', updated_at: new Date() })
      const pjSocket = await findSocketByCharId(io, campaignId, offer.from_char_id)
      if (pjSocket) pjSocket.emit(WS.TRADE_SELL_RESULT, { accepted: false })
    } catch (err) {
      console.error('[TRADE] SELL_DECLINED error:', err.message)
      socket.emit(WS.TRADE_ERROR, { code: 'SERVER_ERROR', message: err.message })
    }
  })

  // PJ A → annule l'offre avant acceptation
  socket.on(WS.TRADE_TRANSFER_CANCELLED, async ({ offerId, fromCharId }) => {
    try {
      // Vérifier que fromCharId appartient bien à cet utilisateur
      const cancellingChar = await db('characters')
        .where({ campaign_id: campaignId, id: fromCharId, user_id: user.id })
        .select('id')
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
