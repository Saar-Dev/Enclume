import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { multerUpload, uploadToMinio } from '../middleware/upload.js'

const router = Router({ mergeParams: true })

// POST /api/battlemaps/:id/tokens — créer un token (GM uniquement)
router.post('/',
  requireAuth,
  multerUpload.single('image'),
  uploadToMinio('tokens'),
  async (req, res) => {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    const { label, pos_x, pos_y, width, height, z_index, visible_to_players, layer, owner_id, cover_percent } = req.body

    const [token] = await db('tokens')
      .insert({
        battlemap_id: req.params.id,
        owner_id: owner_id || null,
        label: label || null,
        image_url: req.file ? req.file.url : null,
        pos_x: pos_x || 0,
        pos_y: pos_y || 0,
        width: width || 64,
        height: height || 64,
        z_index: z_index || 0,
        visible_to_players: visible_to_players !== undefined ? visible_to_players : true,
        layer: layer || 'token',
        cover_percent: cover_percent || 0,
      })
      .returning('*')

    res.status(201).json({ token })
  }
)

// PUT /api/tokens/:id — modifier un token (owner ou GM)
router.put('/:id', requireAuth, async (req, res) => {
  const token = await db('tokens').where({ id: req.params.id }).first()
  if (!token) throw new AppError(404, 'Token not found')

  const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  // Un joueur ne peut modifier que son propre token
  const isGm = member.role === 'gm'
  const isOwner = token.owner_id === req.user.id
  if (!isGm && !isOwner) throw new AppError(403, 'You can only move your own token')

  const { pos_x, pos_y, width, height, z_index, label, visible_to_players, layer, cover_percent, notes } = req.body

  const updates = {}
  if (pos_x !== undefined) updates.pos_x = pos_x
  if (pos_y !== undefined) updates.pos_y = pos_y

  // Les champs suivants sont réservés au GM
  if (isGm) {
    if (width !== undefined) updates.width = width
    if (height !== undefined) updates.height = height
    if (z_index !== undefined) updates.z_index = z_index
    if (label !== undefined) updates.label = label
    if (visible_to_players !== undefined) updates.visible_to_players = visible_to_players
    if (layer !== undefined) updates.layer = layer
    if (cover_percent !== undefined) updates.cover_percent = cover_percent
  }

  // Notes visibles par le propriétaire
  if ((isGm || isOwner) && notes !== undefined) updates.notes = notes

  const [updated] = await db('tokens')
    .where({ id: req.params.id })
    .update(updates)
    .returning('*')

  res.json({ token: updated })
})

// DELETE /api/tokens/:id — supprimer un token (GM uniquement)
router.delete('/:id', requireAuth, async (req, res) => {
  const token = await db('tokens').where({ id: req.params.id }).first()
  if (!token) throw new AppError(404, 'Token not found')

  const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  await db('tokens').where({ id: req.params.id }).delete()
  res.json({ success: true })
})

export default router
