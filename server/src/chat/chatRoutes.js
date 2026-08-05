// chatRoutes.js — docs/PLANS/PLAN_CHAT.md §5.4. Routes REST /api/campaigns/:campaignId/chat/*.
// Pas encore montées dans server/src/index.js (Phase 1 : rien branché dans l'existant, §12).
//
// Autorisation : le plan V1.0 ne vérifiait nulle part l'appartenance à la campagne (trou comblé
// PLAN_CHAT.md §16) — pattern repris tel quel de tradeRoutes.js (requireAuth + campaign_members).
import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { sendMessage, getHistory, deleteMessage } from './chatService.js'
import { getMessageById } from './chatRepository.js'
import { broadcastMessageCreated, broadcastMessageDeleted } from './chatBroadcast.js'

async function getMember(campaignId, userId) {
  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: userId })
    .first()
  if (!member) throw new AppError(403, 'Accès refusé')
  return member
}

export const chatRouter = Router({ mergeParams: true })

chatRouter.use(requireAuth)

// GET /api/campaigns/:campaignId/chat/messages — historique paginé (§5.4)
chatRouter.get('/messages', async (req, res, next) => {
  try {
    const { campaignId } = req.params
    await getMember(campaignId, req.user.id)

    const channelId = req.query.channelId || 'general'
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const { beforeDate, beforeId } = req.query

    const messages = await getHistory(campaignId, channelId, {
      beforeDate: beforeDate || undefined,
      beforeId: beforeId ? Number(beforeId) : undefined,
      limit,
      viewerUserId: req.user.id,
    })

    const last = messages[messages.length - 1]
    res.json({
      messages,
      pagination: {
        hasMore: messages.length === limit,
        nextCursor: last ? { beforeDate: last.createdAt, beforeId: last.id } : null,
      },
    })
  } catch (err) { next(err) }
})

// POST /api/campaigns/:campaignId/chat/messages — envoi (texte seul en V1, §5.4)
chatRouter.post('/messages', async (req, res, next) => {
  try {
    const { campaignId } = req.params
    await getMember(campaignId, req.user.id)

    const { text, characterId } = req.body
    const message = await sendMessage({
      campaignId,
      channelId: 'general',
      senderUserId: req.user.id,
      characterId: characterId || null,
      type: 'TEXT',
      payload: { text },
    })
    await broadcastMessageCreated(req.app.get('io'), campaignId, message)
    res.status(201).json(message)
  } catch (err) { next(err) }
})

// DELETE /api/campaigns/:campaignId/chat/messages/:messageId — suppression douce (auteur ou GM)
chatRouter.delete('/messages/:messageId', async (req, res, next) => {
  try {
    const { campaignId, messageId } = req.params
    const member = await getMember(campaignId, req.user.id)

    const existing = await getMessageById(messageId)
    if (!existing || existing.campaign_id !== campaignId) {
      throw new AppError(404, 'Message introuvable')
    }
    const isAuthor = existing.sender_user_id === req.user.id
    const isGm = member.role === 'gm'
    if (!isAuthor && !isGm) throw new AppError(403, 'Auteur ou MJ uniquement')

    const result = await deleteMessage(messageId)
    broadcastMessageDeleted(req.app.get('io'), campaignId, result)
    res.json(result)
  } catch (err) { next(err) }
})
