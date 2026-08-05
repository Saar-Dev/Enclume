// chatService.js — docs/PLANS/PLAN_CHAT.md §5.2. Logique métier centrale : valide, sanitize,
// persiste, diffuse. Aucune vérification d'appartenance à la campagne ici — c'est le rôle de
// l'appelant (chatRoutes.js / socketChat.js, cf. PLAN_CHAT.md §16).
import { RateLimiterMemory } from 'rate-limiter-flexible'

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { getUserColor } from '../lib/socketUtils.js'
import { validateMessagePayload } from './chatValidation.js'
import { sanitizeMessageText } from './chatSanitizer.js'
import { insertMessage, getMessages, getMessageById, softDelete } from './chatRepository.js'
import { eventBus } from './eventBus.js'

// Pattern repris de socketTrade.js (rate-limiter-flexible déjà en dépendance serveur) : 10
// messages/seconde/utilisateur, PLAN_CHAT.md §11. Clé par campagne+utilisateur, pas globale.
const messageRateLimiter = new RateLimiterMemory({ points: 10, duration: 1 })

async function buildAuthorInfo(senderUserId, characterId) {
  const [author, character, color] = await Promise.all([
    senderUserId ? db('users').where({ id: senderUserId }).select('id', 'username').first() : null,
    characterId ? db('characters').where({ id: characterId }).select('id', 'name').first() : null,
    senderUserId ? getUserColor(db, senderUserId) : null,
  ])
  return {
    author: author ? { id: author.id, username: author.username, color } : null,
    character: character ? { id: character.id, name: character.name } : null,
  }
}

function toClientMessage(row, { author, character }) {
  return {
    id: row.id,
    channelId: row.channel_id,
    type: row.type,
    payload: row.payload,
    author,
    character,
    recipientUserId: row.recipient_user_id,
    createdAt: row.created_at,
  }
}

// sendMessage : point d'entrée unique (§5.2), utilisé aujourd'hui par la saisie utilisateur
// (TEXT/WHISPER) et, à partir de Phase 2, par les Message Builders (senderUserId=null, payload
// structuré sans .text — cf. §7 combatDamage.js). Validation/sanitization/rate-limit ne s'appliquent
// qu'à la saisie utilisateur réelle : un message système est une donnée interne déjà de confiance,
// pas du texte brut à nettoyer, et ne doit pas partager le même quota que la frappe d'un joueur.
export async function sendMessage({
  campaignId, channelId, senderUserId = null, characterId = null, recipientUserId = null, type, payload,
}) {
  const isUserSubmitted = senderUserId != null

  if (isUserSubmitted) {
    try {
      await messageRateLimiter.consume(`${campaignId}:${senderUserId}`)
    } catch {
      throw new AppError(429, 'Trop de messages envoyés, ralentis')
    }

    const validationError = validateMessagePayload({ type, payload })
    if (validationError) throw new AppError(400, validationError)
  }

  const sanitizedPayload = isUserSubmitted && typeof payload?.text === 'string'
    ? { ...payload, text: sanitizeMessageText(payload.text) }
    : payload

  const row = await insertMessage({
    campaign_id: campaignId,
    channel_id: channelId,
    sender_user_id: senderUserId,
    character_id: characterId,
    recipient_user_id: recipientUserId,
    type,
    payload: sanitizedPayload,
  })

  const { author, character } = await buildAuthorInfo(senderUserId, characterId)
  return toClientMessage(row, { author, character })
}

// getHistory : pagination par curseur (§5.4). viewerUserId sert au filtrage whisper (§16) —
// obligatoire quand channelId === 'whisper', ignoré sinon.
export async function getHistory(campaignId, channelId, { beforeDate, beforeId, limit, viewerUserId } = {}) {
  const rows = await getMessages(campaignId, channelId, { beforeDate, beforeId, limit, viewerUserId })
  return Promise.all(
    rows.map(async (row) => {
      const { author, character } = await buildAuthorInfo(row.sender_user_id, row.character_id)
      return toClientMessage(row, { author, character })
    }),
  )
}

// deleteMessage : suppression douce. L'autorisation (auteur ou GM) est vérifiée par l'appelant
// (chatRoutes.js), pas ici — même séparation que chatRepository.js.
export async function deleteMessage(messageId) {
  const existing = await getMessageById(messageId)
  if (!existing || existing.deleted_at) throw new AppError(404, 'Message introuvable')
  await softDelete(messageId)
  return { id: existing.id, channelId: existing.channel_id }
}

// ─── EventBus (Phase 2+) ──────────────────────────────────────────────────────────────────────
// Existent dès Phase 1 mais rien n'est encore enregistré : aucun module métier ne publie encore sur
// l'EventBus (PLAN_CHAT.md §6.3, Strangler Fig Phase 1/2). listenEvents() est un no-op tant que
// registerBuilder() n'a pas été appelé pour au moins un topic.
const builders = new Map()

export function registerBuilder(topic, builder) {
  builders.set(topic, builder)
}

export function listenEvents() {
  for (const [topic, builder] of builders) {
    eventBus.subscribe(topic, async (event) => {
      const draft = builder.build(event)
      await sendMessage({ campaignId: event.campaignId, senderUserId: null, ...draft })
    })
  }
}
