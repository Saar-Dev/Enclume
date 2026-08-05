// socketChat.js — docs/PLANS/PLAN_CHAT.md §5.5. Handlers WebSocket du chat persistant.
// Pas encore appelé depuis server/src/socket/index.js (Phase 1 : rien branché dans l'existant,
// §12 — le handler CHAT_MESSAGE existant de socketDice.js continue de fonctionner tel quel).
//
// Signature registerChatHandlers(io, socket, context) — même patron que registerDiceHandlers
// (socketDice.js) / registerTradeHandlers (socketTrade.js).
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { sendMessage } from './chatService.js'
import { chatCommandRegistry } from './chatCommands.js'
import { broadcastMessageCreated } from './chatBroadcast.js'

async function findCampaignMemberByUsername(campaignId, username) {
  const row = await db('campaign_members')
    .join('users', 'users.id', 'campaign_members.user_id')
    .where({ 'campaign_members.campaign_id': campaignId, 'users.username': username })
    .select('users.id as userId')
    .first()
  return row ? { userId: row.userId } : null
}

async function findGmUserId(campaignId) {
  const row = await db('campaign_members').where({ campaign_id: campaignId, role: 'gm' }).select('user_id').first()
  return row?.user_id ?? null
}

// "/nom arg1 arg2" -> { name: 'nom', args: ['arg1', 'arg2'] }. null si pas une commande.
// /r et /roll sont volontairement ignorés ici : flux DICE_ROLL existant conservé (§9, §15).
function parseSlashCommand(text) {
  if (!text?.startsWith('/')) return null
  const [rawName, ...args] = text.slice(1).trim().split(/\s+/)
  const name = rawName.toLowerCase()
  if (name === 'r' || name === 'roll') return null
  return { name, args }
}

export function registerChatHandlers(io, socket, context) {
  const { campaignId, user } = context

  // chat:send — client → serveur : { channelId, type, payload }. §5.5.
  socket.on(WS.CHAT_SEND, async ({ channelId = 'general', type = 'TEXT', payload } = {}) => {
    if (!campaignId || !user) return

    try {
      const slash = type === 'TEXT' ? parseSlashCommand(payload?.text) : null

      if (slash) {
        const commandContext = {
          campaignId,
          user,
          isGm: socket.data.role === 'gm',
          findCampaignMemberByUsername: (username) => findCampaignMemberByUsername(campaignId, username),
          gmUserId: await findGmUserId(campaignId),
        }
        const result = await chatCommandRegistry.execute(slash.name, commandContext, slash.args)

        if (result.reply) {
          // Réponse privée non persistée (aide, erreur d'usage) — jamais de texte figé, cf. chatCommands.js.
          socket.emit(WS.CHAT_MESSAGE_CREATED, {
            system: true,
            private: true,
            i18nKey: result.reply.i18nKey,
            params: result.reply.params,
            timestamp: new Date().toISOString(),
          })
          return
        }

        const message = await sendMessage({ campaignId, senderUserId: user.id, ...result.send })
        await broadcastMessageCreated(io, campaignId, message)
        return
      }

      const message = await sendMessage({ campaignId, channelId, senderUserId: user.id, type, payload })
      await broadcastMessageCreated(io, campaignId, message)
    } catch (err) {
      const code = err instanceof AppError ? err.statusCode : 500
      socket.emit(WS.CHAT_ERROR, { code, message: err.message })
    }
  })
}
