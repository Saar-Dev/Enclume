import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { multerUpload, uploadToMinio } from '../middleware/upload.js'
import { calcAttributeNA, calcREA } from '../lib/charStats.js'
import { removeTokens } from '../lib/tokenLifecycle.js'

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

// GET /api/battlemaps/:id/combat-ini — INI (REA) preview pour CombatRosterWindow
// Calcule base_ini de chaque token sans toucher à la DB combat — lecture seule.
router.get('/:id/combat-ini', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const tokens = await db('tokens').where({ battlemap_id: req.params.id })
  const iniPreview = []
  for (const token of tokens) {
    let base_ini = 0
    try {
      const cs = await db('char_sheet').where({ character_id: token.character_id }).first()
      if (cs) {
        const [attrs, archetype] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: cs.id }),
          db('char_archetype').where({ char_sheet_id: cs.id }).first(),
        ])
        const genotypeRow = archetype?.genotype_id
          ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
          : null
        base_ini = calcREA(
          calcAttributeNA(attrs, 'ADA', genotypeRow),
          calcAttributeNA(attrs, 'PER', genotypeRow)
        )
      }
    } catch (_) {}
    iniPreview.push({ token_id: token.id, base_ini })
  }
  res.json({ iniPreview })
})

// GET /api/battlemaps/:id/combat-equipment — équipement arme+armure par token (CombatRosterWindow)
const WEAPON_SLOTS_SET = new Set(['MG', 'MD', '2M', 'Tr'])
const NON_ARMOR_SLOTS  = new Set(['MG', 'MD', '2M', 'Tr', 'D', 'Ce'])

router.get('/:id/combat-equipment', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const tokens = await db('tokens').where({ battlemap_id: req.params.id })
  const equipment = {}

  for (const token of tokens) {
    if (!token.character_id) continue

    const [weaponRow, armorRows] = await Promise.all([
      db('char_inventory')
        .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where('char_inventory.character_id', token.character_id)
        .whereIn('char_inventory.slot', ['MG', 'MD', '2M', 'Tr'])
        .select('char_inventory.id as inv_id', 'ref_equipment.name', 'char_inventory.slot', 'ref_equipment.fire_mode as ref_fire_mode')
        .first(),

      db('char_inventory')
        .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where('char_inventory.character_id', token.character_id)
        .where('ref_equipment.family', 'Protections')
        .whereNotNull('char_inventory.slot')
        .whereNotIn('char_inventory.slot', ['MG', 'MD', '2M', 'Tr', 'D', 'Ce'])
        .select('char_inventory.id as inv_id', 'ref_equipment.name', 'ref_equipment.location'),
    ])

    equipment[token.id] = {
      characterId:  token.character_id,
      weapon:       weaponRow ?? null,
      armorPieces:  armorRows,
    }
  }

  res.json({ equipment })
})

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

  // Tokens visibles selon le rôle — JOIN pour user_color toujours à jour
  let tokensQuery = db('tokens')
    .leftJoin('characters', 'tokens.character_id', 'characters.id')
    .leftJoin('users', 'characters.user_id', 'users.id')
    .where({ 'tokens.battlemap_id': req.params.id })
  if (member.role !== 'gm') {
    tokensQuery = tokensQuery
      .where({ 'tokens.visible_to_players': true })
      .whereNot({ 'tokens.layer': 'gm' })
  }
  const tokens = await tokensQuery.select('tokens.*', 'users.color as user_color')

  // Enrichir chaque token avec ses statuts actifs
  const tokenIds = tokens.map(t => t.id)
  let statusMap = {}
  if (tokenIds.length > 0) {
    const allStatuses = await db('token_statuses')
      .whereIn('token_id', tokenIds)
      .select('token_id', 'status_code')
    allStatuses.forEach(s => {
      if (!statusMap[s.token_id]) statusMap[s.token_id] = []
      statusMap[s.token_id].push(s.status_code)
    })
  }
  const tokensWithStatuses = tokens.map(t => ({ ...t, statuses: statusMap[t.id] || [] }))

  res.json({ battlemap, tokens: tokensWithStatuses })
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

    // updated_at systématique sur tout PUT
    updates.updated_at = db.fn.now()

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

  // Supprimer d'abord les tokens de cette carte (nettoyage Redis + broadcast TOKEN_DELETED) —
  // sans quoi le CASCADE SQL efface les lignes mais laisse la collision map Redis et les clients
  // connectés désynchronisés (même trou que la suppression de character, tokenLifecycle.js)
  const tokens = await db('tokens')
    .select('id', 'battlemap_id', 'pos_x', 'pos_y', 'pos_z', 'layer')
    .where({ battlemap_id: req.params.id })
  if (tokens.length) {
    const io = req.app.get('io')
    await removeTokens(io, tokens, battlemap.campaign_id)
  }

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
    if (!voxel_data || typeof voxel_data !== 'object' || Array.isArray(voxel_data)) {
      throw new AppError(400, 'voxel_data must be an object')
    }

    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    await db('battlemaps')
      .where({ id: req.params.id })
      .update({ voxel_data: JSON.stringify(voxel_data), updated_at: db.fn.now() })

    // Recalcul battlemap_texture_usage — index des textures utilisées (O(1) pour DELETE /voxel-textures/:id)
    const usedTexIds = [...new Set(Object.values(voxel_data).map(v => v.tex))]
    await db('battlemap_texture_usage')
      .where({ battlemap_id: req.params.id })
      .delete()
    if (usedTexIds.length > 0) {
      await db('battlemap_texture_usage').insert(
        usedTexIds.map(texId => ({
          battlemap_id: req.params.id,
          voxel_texture_id: texId,
        }))
      )
    }

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/battlemaps/:id/duplicate — dupliquer une carte
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  const [duplicated] = await db('battlemaps')
    .insert({
      campaign_id: battlemap.campaign_id,
      name: `${battlemap.name} (copie)`,
      folder: battlemap.folder,
      scale_label: battlemap.scale_label,
      grid_size: battlemap.grid_size,
      grid_enabled: battlemap.grid_enabled,
      grid_opacity: battlemap.grid_opacity,
      voxel_data: battlemap.voxel_data ? JSON.stringify(battlemap.voxel_data) : null,
      // image_url et cover_image_url non copiés — la carte est nouvelle
    })
    .returning('*')

  res.status(201).json({ battlemap: duplicated })
})

// POST /api/battlemaps/:id/editor-lock — acquérir le lock éditeur (GM uniquement)
router.post('/:id/editor-lock', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    // Vérifier si le lock est actif par quelqu'un d'autre
    const isLocked = battlemap.editor_locked_by
      && battlemap.editor_locked_by !== req.user.id
      && battlemap.editor_locked_until > new Date()
    if (isLocked) {
      return res.status(423).json({ lockedBy: battlemap.editor_locked_by })
    }

    const lockedUntil = new Date(Date.now() + 60 * 1000)
    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_by: req.user.id,
      editor_locked_until: lockedUntil,
    })
    res.json({ ok: true, lockedUntil })
  } catch (err) { next(err) }
})

// DELETE /api/battlemaps/:id/editor-lock — libérer le lock
router.delete('/:id/editor-lock', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    // Seul le titulaire du lock peut le libérer
    if (battlemap.editor_locked_by !== req.user.id) {
      throw new AppError(403, 'Not lock owner')
    }

    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_by: null,
      editor_locked_until: null,
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// POST /api/battlemaps/:id/editor-heartbeat — renouveler le lock (toutes les 30s)
router.post('/:id/editor-heartbeat', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    // Seul le titulaire peut renouveler
    if (battlemap.editor_locked_by !== req.user.id) {
      throw new AppError(403, 'Not lock owner')
    }

    const lockedUntil = new Date(Date.now() + 60 * 1000)
    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_until: lockedUntil,
    })
    res.json({ ok: true, lockedUntil })
  } catch (err) { next(err) }
})

export default router
