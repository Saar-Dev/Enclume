import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { removeTokens } from '../lib/tokenLifecycle.js'
import { invalidateBattlemapWorld } from '../services/worldService.js'

// docs/PLAN_BATTLEMAP2D.md §9 (Lot 4) — même patron que battlemaps.js : un seul router, monté deux
// fois (`/api/campaigns/:id/battlemap-folders` pour lister/créer, `/api/battlemap-folders` pour les
// routes scopées par id de dossier, campaign_id retrouvé depuis la ligne).
const router = Router({ mergeParams: true })

// GET /api/campaigns/:id/battlemap-folders — liste plate (le client reconstruit l'arbre depuis
// parent_folder_id). Même niveau d'autorisation que GET /campaigns/:id/battlemaps (membre suffit, pas
// besoin d'être MJ) — l'UI qui consomme cette liste (sélecteur de cartes) est déjà gardée `isGm` côté
// client, purement organisationnel, rien de sensible dans un nom de dossier.
router.get('/', requireAuth, async (req, res) => {
  const member = await db('campaign_members')
    .where({ campaign_id: req.params.id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const folders = await db('battlemap_folders')
    .where({ campaign_id: req.params.id })
    .select('id', 'parent_folder_id', 'name', 'created_at')
    .orderBy('name', 'asc')
  res.json({ folders })
})

// POST /api/campaigns/:id/battlemap-folders — créer un dossier
router.post('/', requireAuth, requireRole('gm'), async (req, res) => {
  const { name, parent_folder_id } = req.body
  if (!name) throw new AppError(400, 'Folder name is required')

  if (parent_folder_id) {
    const parent = await db('battlemap_folders')
      .where({ id: parent_folder_id, campaign_id: req.params.id })
      .first()
    if (!parent) throw new AppError(400, 'Invalid parent folder')
  }

  const [folder] = await db('battlemap_folders')
    .insert({
      id: randomUUID(),
      campaign_id: req.params.id,
      parent_folder_id: parent_folder_id || null,
      name,
    })
    .returning('*')
  res.status(201).json({ folder })
})

// PUT /api/battlemap-folders/:id — renommer et/ou déplacer (changer de parent)
router.put('/:id', requireAuth, async (req, res) => {
  const folder = await db('battlemap_folders').where({ id: req.params.id }).first()
  if (!folder) throw new AppError(404, 'Folder not found')

  const member = await db('campaign_members')
    .where({ campaign_id: folder.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  const { name, parent_folder_id } = req.body
  const updates = {}
  if (name !== undefined) updates.name = name
  if (parent_folder_id !== undefined) {
    if (parent_folder_id === folder.id) throw new AppError(400, 'A folder cannot be its own parent')
    if (parent_folder_id) {
      const parent = await db('battlemap_folders')
        .where({ id: parent_folder_id, campaign_id: folder.campaign_id })
        .first()
      if (!parent) throw new AppError(400, 'Invalid parent folder')
    }
    updates.parent_folder_id = parent_folder_id || null
  }
  updates.updated_at = db.fn.now()

  const [updated] = await db('battlemap_folders')
    .where({ id: req.params.id })
    .update(updates)
    .returning('*')
  res.json({ folder: updated })
})

// DELETE /api/battlemap-folders/:id — suppression récursive (CASCADE SQL sous-dossiers/cartes),
// même garde-fou que DELETE /battlemaps/:id : nettoyer tokens (Redis + broadcast) AVANT la
// suppression SQL, sans quoi le CASCADE efface les lignes silencieusement pour les clients connectés.
router.delete('/:id', requireAuth, async (req, res) => {
  const folder = await db('battlemap_folders').where({ id: req.params.id }).first()
  if (!folder) throw new AppError(404, 'Folder not found')

  const member = await db('campaign_members')
    .where({ campaign_id: folder.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  // Sous-dossiers en profondeur (BFS) — pour retrouver toutes les cartes affectées avant suppression.
  const allFolderIds = [folder.id]
  let frontier = [folder.id]
  while (frontier.length) {
    const children = await db('battlemap_folders').whereIn('parent_folder_id', frontier).select('id')
    frontier = children.map(c => c.id)
    allFolderIds.push(...frontier)
  }

  const affectedMaps = await db('battlemaps').whereIn('folder_id', allFolderIds).select('id')
  const affectedMapIds = affectedMaps.map(m => m.id)

  if (affectedMapIds.length) {
    const tokens = await db('tokens')
      .select('id', 'battlemap_id', 'pos_x', 'pos_y', 'pos_z', 'layer')
      .whereIn('battlemap_id', affectedMapIds)
    if (tokens.length) {
      const io = req.app.get('io')
      await removeTokens(io, tokens, folder.campaign_id)
    }
  }

  // CASCADE SQL : sous-dossiers + cartes (+ tokens restants, déjà nettoyés ci-dessus).
  await db('battlemap_folders').where({ id: folder.id }).delete()
  for (const mapId of affectedMapIds) invalidateBattlemapWorld(mapId)

  // Fallback default_battlemap_id — même logique que DELETE /battlemaps/:id.
  if (affectedMapIds.length) {
    const campaign = await db('campaigns').where({ id: folder.campaign_id }).first()
    if (affectedMapIds.includes(campaign.default_battlemap_id)) {
      const nextMap = await db('battlemaps')
        .where({ campaign_id: folder.campaign_id })
        .orderBy('created_at', 'asc')
        .first()
      await db('campaigns')
        .where({ id: folder.campaign_id })
        .update({ default_battlemap_id: nextMap ? nextMap.id : null })
    }
  }

  res.json({ success: true, deletedMapIds: affectedMapIds })
})

export default router
