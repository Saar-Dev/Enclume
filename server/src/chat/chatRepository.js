// chatRepository.js — docs/PLANS/PLAN_CHAT.md §5.3. Accès PostgreSQL (Knex) pur, aucune règle
// d'autorisation ici — c'est le rôle de chatService.js / chatRoutes.js (core.md : "Les accès DB
// passent par les services/repositories existants").
import db from '../db/knex.js'

export async function insertMessage(data) {
  const [row] = await db('chat_messages').insert(data).returning('*')
  return row
}

// Pagination par curseur descendant (cf. idx_chat_messages_cursor, migration 232).
// viewerUserId : obligatoire pour channelId === 'whisper' — un whisper n'est visible que de
// l'expéditeur ou du destinataire (PLAN_CHAT.md §16, colonne recipient_user_id).
export async function getMessages(
  campaignId,
  channelId,
  { beforeDate, beforeId, limit = 50, viewerUserId } = {},
) {
  let query = db('chat_messages')
    .where({ campaign_id: campaignId, channel_id: channelId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)

  if (channelId === 'whisper') {
    if (!viewerUserId) throw new Error('viewerUserId requis pour lire le canal whisper')
    query = query.where(function () {
      this.where('sender_user_id', viewerUserId).orWhere('recipient_user_id', viewerUserId)
    })
  }

  if (beforeDate && beforeId) {
    query = query.where(function () {
      this.where('created_at', '<', beforeDate).orWhere(function () {
        this.where('created_at', beforeDate).where('id', '<', beforeId)
      })
    })
  }

  return query
}

export async function getMessageById(messageId) {
  return db('chat_messages').where({ id: messageId }).first()
}

export async function softDelete(messageId) {
  const [row] = await db('chat_messages')
    .where({ id: messageId })
    .update({ deleted_at: db.fn.now() })
    .returning('*')
  return row
}
