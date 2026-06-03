import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { WS } from '../../../shared/events.js'

// Monté sous /api/campaigns/:campaignId/documents
// Requiert mergeParams pour accéder à req.params.campaignId
const router = Router({ mergeParams: true })

// ─── Helpers permission ──────────────────────────────────────────────────────

function canView(doc, userId) {
  const v = doc.viewer_ids
  if (v === 'all') return true
  if (v === 'none') return false
  return Array.isArray(v) && v.includes(userId)
}

function canEdit(doc, userId) {
  const e = doc.editor_ids
  if (e === 'all') return true
  if (e === 'none') return false
  return Array.isArray(e) && e.includes(userId)
}

// Broadcast filtré : GM reçoit le doc complet, les autres reçoivent sans gm_notes_html.
// Seuls les sockets autorisés (canView ou GM) reçoivent l'événement.
async function broadcastDoc(io, campaignId, doc, eventName) {
  const { gm_notes_html, ...publicDoc } = doc
  const sockets = await io.in(campaignId).fetchSockets()
  for (const s of sockets) {
    const sockIsGm = s.data.role === 'gm'
    if (!sockIsGm && !canView(doc, s.data.userId)) continue
    s.emit(eventName, sockIsGm ? doc : publicDoc)
  }
}

// ─── GET / — liste des documents visibles ───────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params

  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Not a member of this campaign')

  const isGm = member.role === 'gm'

  const docs = await db('campaign_documents')
    .where({ campaign_id: campaignId })
    .orderBy('created_at', 'asc')

  const visible = isGm
    ? docs
    : docs.filter(d => canView(d, req.user.id))

  // Retirer gm_notes_html pour les non-GM
  const result = visible.map(d => {
    if (isGm) return d
    const { gm_notes_html, ...pub } = d
    return pub
  })

  res.json({ documents: result })
})

// ─── POST / — créer un document (GM uniquement) ─────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params

  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Not a member of this campaign')
  if (member.role !== 'gm') throw new AppError(403, 'GM only')

  const { name, content_html = '', gm_notes_html = '', viewer_ids = 'none', editor_ids = 'none' } = req.body
  if (!name?.trim()) throw new AppError(400, 'name is required')

  const [doc] = await db('campaign_documents')
    .insert({
      campaign_id: campaignId,
      name: name.trim(),
      content_html,
      gm_notes_html,
      viewer_ids: JSON.stringify(viewer_ids),
      editor_ids: JSON.stringify(editor_ids),
      created_by: req.user.id,
    })
    .returning('*')

  const io = req.app.get('io')
  await broadcastDoc(io, campaignId, doc, WS.DOC_CREATED)

  res.status(201).json({ document: doc })
})

// ─── GET /:docId — lire un document ─────────────────────────────────────────

router.get('/:docId', requireAuth, async (req, res) => {
  const { campaignId, docId } = req.params

  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Not a member of this campaign')

  const doc = await db('campaign_documents')
    .where({ id: docId, campaign_id: campaignId })
    .first()
  if (!doc) throw new AppError(404, 'Document not found')

  const isGm = member.role === 'gm'
  if (!isGm && !canView(doc, req.user.id)) throw new AppError(403, 'Access denied')

  if (isGm) return res.json({ document: doc })

  const { gm_notes_html, ...pub } = doc
  res.json({ document: pub })
})

// ─── PUT /:docId — modifier un document ─────────────────────────────────────

router.put('/:docId', requireAuth, async (req, res) => {
  const { campaignId, docId } = req.params

  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Not a member of this campaign')

  const doc = await db('campaign_documents')
    .where({ id: docId, campaign_id: campaignId })
    .first()
  if (!doc) throw new AppError(404, 'Document not found')

  const isGm = member.role === 'gm'
  if (!isGm && !canEdit(doc, req.user.id)) throw new AppError(403, 'Access denied')

  // Champs modifiables par tous les ayants droit
  const updates = {}
  if (req.body.name !== undefined) updates.name = req.body.name.trim()
  if (req.body.content_html !== undefined) updates.content_html = req.body.content_html

  // Champs réservés au GM
  if (isGm) {
    if (req.body.gm_notes_html !== undefined) updates.gm_notes_html = req.body.gm_notes_html
    if (req.body.viewer_ids !== undefined) updates.viewer_ids = JSON.stringify(req.body.viewer_ids)
    if (req.body.editor_ids !== undefined) updates.editor_ids = JSON.stringify(req.body.editor_ids)
  }

  if (Object.keys(updates).length === 0) throw new AppError(400, 'Nothing to update')

  updates.updated_at = db.fn.now()

  const [updated] = await db('campaign_documents')
    .where({ id: docId })
    .update(updates)
    .returning('*')

  const io = req.app.get('io')
  await broadcastDoc(io, campaignId, updated, WS.DOC_UPDATED)

  res.json({ document: updated })
})

// ─── DELETE /:docId — supprimer un document (GM uniquement) ─────────────────

router.delete('/:docId', requireAuth, async (req, res) => {
  const { campaignId, docId } = req.params

  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Not a member of this campaign')
  if (member.role !== 'gm') throw new AppError(403, 'GM only')

  const doc = await db('campaign_documents')
    .where({ id: docId, campaign_id: campaignId })
    .first()
  if (!doc) throw new AppError(404, 'Document not found')

  await db('campaign_documents').where({ id: docId }).del()

  // DOC_DELETED : pas de données sensibles, broadcast à toute la room
  req.app.get('io').to(campaignId).emit(WS.DOC_DELETED, { id: docId })

  res.json({ ok: true })
})

export default router
