import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { multerUpload, uploadToMinio } from '../middleware/upload.js'

const router = Router({ mergeParams: true })

// GET /api/campaigns/:id/battlemaps — liste des cartes
router.get('/', requireAuth, async (req, res) => {
  const member = await db('campaign_members')
    .where({ campaign_id: req.params.id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const battlemaps = await db('battlemaps')
    .where({ campaign_id: req.params.id })
    .select('id', 'name', 'folder', 'image_url', 'grid_size', 'grid_enabled', 'scale_label', 'created_at')
    .orderBy('created_at', 'asc')
  res.json({ battlemaps })
})

// POST /api/campaigns/:id/battlemaps — créer une carte
router.post('/',
  requireAuth,
  requireRole('gm'),
  multerUpload.single('image'),
  uploadToMinio('battlemaps'),
  async (req, res) => {
    const { name, folder, scale_label, grid_size, grid_enabled } = req.body
    if (!name) throw new AppError(400, 'Battlemap name is required')

    const [battlemap] = await db('battlemaps')
      .insert({
        campaign_id: req.params.id,
        name,
        folder: folder || null,
        scale_label: scale_label || '1,5m',
        grid_size: grid_size || 64,
        grid_enabled: grid_enabled !== undefined ? grid_enabled : true,
        image_url: req.file ? req.file.url : null,
      })
      .returning('*')

    res.status(201).json({ battlemap })
  }
)

// GET /api/battlemaps/:id — carte complète avec tokens
router.get('/:id', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps')
    .where({ 'battlemaps.id': req.params.id })
    .first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  // Vérifier que l'utilisateur est membre de la campagne
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  // Tokens visibles selon le rôle
  let tokensQuery = db('tokens').where({ battlemap_id: req.params.id })
  if (member.role !== 'gm') {
    tokensQuery = tokensQuery.where({ visible_to_players: true }).whereNot({ layer: 'gm' })
  }
  const tokens = await tokensQuery.select('*')

  res.json({ battlemap, tokens })
})

// PUT /api/battlemaps/:id — modifier une carte
router.put('/:id',
  requireAuth,
  multerUpload.single('image'),
  uploadToMinio('battlemaps'),
  async (req, res) => {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    const { name, folder, scale_label, grid_size, grid_enabled, grid_opacity, viewport_state } = req.body

    const updates = {}
    if (name !== undefined) updates.name = name
    if (folder !== undefined) updates.folder = folder
    if (scale_label !== undefined) updates.scale_label = scale_label
    if (grid_size !== undefined) updates.grid_size = grid_size
    if (grid_enabled !== undefined) updates.grid_enabled = grid_enabled
    if (grid_opacity !== undefined) updates.grid_opacity = grid_opacity
    if (viewport_state !== undefined) updates.viewport_state = viewport_state
    if (req.file) updates.image_url = req.file.url

    const [updated] = await db('battlemaps')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*')

    res.json({ battlemap: updated })
  }
)

// DELETE /api/battlemaps/:id — supprimer une carte
router.delete('/:id', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  await db('battlemaps').where({ id: req.params.id }).delete()

  // Fallback : si c'était la carte d'accueil, on assigne la plus ancienne restante
  const campaign = await db('campaigns').where({ id: battlemap.campaign_id }).first()
  if (campaign.default_battlemap_id === req.params.id) {
    const nextMap = await db('battlemaps')
      .where({ campaign_id: battlemap.campaign_id })
      .orderBy('created_at', 'asc')
      .first()
    await db('campaigns')
      .where({ id: battlemap.campaign_id })
      .update({ default_battlemap_id: nextMap ? nextMap.id : null })
  }

  res.json({ success: true })
})

// PUT /api/battlemaps/:id/voxels — mettre à jour les données voxel
router.put('/:id/voxels', requireAuth, async (req, res, next) => {
  try {
    const { voxel_data } = req.body
    if (!Array.isArray(voxel_data)) throw new AppError(400, 'voxel_data must be an array')

    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    await db('battlemaps')
      .where({ id: req.params.id })
      .update({ voxel_data: JSON.stringify(voxel_data) })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
export default router
