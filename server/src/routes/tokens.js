import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { WS } from '../../../shared/events.js'
import { removeTokens } from '../lib/tokenLifecycle.js'
import { bumpBattlemapRuntimeRevision } from '../services/worldRuntimeService.js'
import { worldPointToDbPosition } from '../../../shared/world/worldMetrics.js'
import { resolveBattlemapPlacement } from '../services/worldMovementService.js'

const router = Router({ mergeParams: true })

// POST /api/battlemaps/:id/tokens — créer un token
// GM : toujours autorisé, peut créer autant de tokens qu'il veut.
// Joueur : autorisé uniquement si character.user_id === req.user.id
//          et si aucun token avec ce character_id n'existe déjà sur cette battlemap.
router.post('/', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const isGm = member.role === 'gm'

  const {
    character_id,
    label,
    destination = { x: 0, y: 0, z: 0 },
    width = 64,
    height = 64,
    z_index = 0,
    visible_to_players = true,
    layer = 'token',
    owner_id,
    cover_percent = 0,
    color,
  } = req.body

  if (req.body.pos_x !== undefined || req.body.pos_y !== undefined || req.body.pos_z !== undefined) {
    throw new AppError(400, 'Token creation uses destination in world-feet coordinates')
  }

  if (!isGm) {
    // Joueur : character_id obligatoire
    if (!character_id) throw new AppError(403, 'Players must provide a character_id')

    // Vérifier que le joueur est propriétaire du character
    const character = await db('characters').where({ id: character_id }).first()
    if (!character) throw new AppError(404, 'Character not found')
    if (character.user_id !== req.user.id) throw new AppError(403, 'You do not own this character')

    // Vérifier qu'aucun token de ce character n'existe déjà sur cette battlemap
    const existing = await db('tokens')
      .where({ battlemap_id: req.params.id, character_id })
      .first()
    if (existing) throw new AppError(409, 'A token for this character already exists on this battlemap')
  }

  let placement
  try {
    placement = await resolveBattlemapPlacement({ battlemap, destination })
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      throw new AppError(400, error.message)
    }
    throw error
  }
  if (!placement) throw new AppError(409, 'No free walkable surface near token destination')

  const [token] = await db('tokens')
    .insert({
      battlemap_id: req.params.id,
      character_id: character_id || null,
      owner_id: owner_id || null,
      label: label || null,
      image_url: null,
      ...worldPointToDbPosition(placement),
      position_space: 'world-feet',
      width,
      height,
      z_index,
      visible_to_players,
      layer,
      cover_percent,
      color: color || null,
    })
    .returning('*')
  const runtimeRevision = await bumpBattlemapRuntimeRevision(battlemap.id)

  // Broadcaster TOKEN_CREATED à toute la room — le serveur est seul émetteur
  const io = req.app.get('io')
  io.to(battlemap.campaign_id).emit(WS.TOKEN_CREATED, { token })
  io.to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
    battlemapId: battlemap.id,
    runtimeRevision,
    kind: 'token-created',
  })

  res.status(201).json({ token })
})

// POST /api/tokens/:id/teleport — bypass spatial explicite, réservé au MJ.
// Cette commande sert aussi à placer volontairement un ancien token dans l'espace world-feet.
router.post('/:id/teleport', requireAuth, async (req, res, next) => {
  try {
    const token = await db('tokens').where({ id: req.params.id }).first()
    if (!token) throw new AppError(404, 'Token not found')
    const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    let destination
    try {
      destination = worldPointToDbPosition(req.body.destination)
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw new AppError(400, error.message)
      }
      throw error
    }

    let updated
    let runtimeRevision
    await db.transaction(async trx => {
      const currentMap = await trx('battlemaps').where({ id: token.battlemap_id }).forUpdate().first()
      const currentToken = await trx('tokens').where({ id: token.id }).forUpdate().first()
      if (!currentMap || !currentToken) throw new AppError(409, 'World state changed before teleport')
      // Un teleport est un détachement administratif explicite. Sans ceci, la prochaine
      // réconciliation de cabine ramènerait le token à son ancienne position locale.
      await trx('world_elevator_passengers').where({ token_id: token.id }).del()
      ;[updated] = await trx('tokens')
        .where({ id: token.id })
        .update({
          ...destination,
          position_space: 'world-feet',
          updated_at: trx.fn.now(),
        })
        .returning('*')
      const [runtime] = await trx('battlemaps')
        .where({ id: token.battlemap_id })
        .update({ runtime_revision: Number(currentMap.runtime_revision || 0) + 1 })
        .returning('runtime_revision')
      runtimeRevision = runtime.runtime_revision
    })

    req.app.get('io').to(battlemap.campaign_id).emit(WS.TOKEN_MOVED, {
      tokenId: updated.id,
      pos_x: updated.pos_x,
      pos_y: updated.pos_y,
      pos_z: updated.pos_z,
      position_space: updated.position_space,
      updated_at: updated.updated_at,
      teleport: true,
      runtimeRevision,
    })
    res.json({ token: updated, runtimeRevision, coordinateSpace: 'world-feet' })
  } catch (error) {
    next(error)
  }
})

// PUT /api/tokens/:id — modifier un token (owner ou GM)
router.put('/:id', requireAuth, async (req, res) => {
  const token = await db('tokens').where({ id: req.params.id }).first()
  if (!token) throw new AppError(404, 'Token not found')

  const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const isGm = member.role === 'gm'

  // Ownership : GM ou propriétaire du character lié au token
  let isOwner = false
  if (token.character_id) {
    const character = await db('characters').where({ id: token.character_id }).first()
    isOwner = character?.user_id === req.user.id
  }
  if (!isGm && !isOwner) throw new AppError(403, 'You can only move your own token')

  const {
    pos_x, pos_y, pos_z,
    width, height, z_index,
    label, visible_to_players, layer,
    cover_percent, notes, color,
  } = req.body

  const updates = {}

  // Une modification générique ne peut plus contourner le moteur de monde.
  if (pos_x !== undefined || pos_y !== undefined || pos_z !== undefined) {
    throw new AppError(400, 'Use world-move for game movement or teleport for a GM bypass')
  }

  // Champs réservés au GM
  if (isGm) {
    if (width !== undefined) updates.width = width
    if (height !== undefined) updates.height = height
    if (z_index !== undefined) updates.z_index = z_index
    if (label !== undefined) updates.label = label
    if (visible_to_players !== undefined) updates.visible_to_players = visible_to_players
    if (layer !== undefined) updates.layer = layer
    if (cover_percent !== undefined) updates.cover_percent = cover_percent
    if (color !== undefined) updates.color = color
  }

  // Notes — GM et propriétaire
  if ((isGm || isOwner) && notes !== undefined) updates.notes = notes

  if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

  // updated_at systématique sur tout PUT — P13 : après le guard Object.keys
  updates.updated_at = db.fn.now()

  const [updated] = await db('tokens')
    .where({ id: req.params.id })
    .update(updates)
    .returning('*')

  // Une édition de métadonnées ne doit pas se faire passer pour un déplacement.
  const io = req.app.get('io')
  io.to(battlemap.campaign_id).emit(WS.TOKEN_UPDATED, { token: updated })

  res.json({ token: updated })
})

// DELETE /api/tokens/:id — supprimer un token (GM ou propriétaire du character)
router.delete('/:id', requireAuth, async (req, res) => {
  const token = await db('tokens').where({ id: req.params.id }).first()
  if (!token) throw new AppError(404, 'Token not found')

  const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const isGm = member.role === 'gm'

  // Ownership : GM ou propriétaire du character lié au token
  let isOwner = false
  if (token.character_id) {
    const character = await db('characters').where({ id: token.character_id }).first()
    isOwner = character?.user_id === req.user.id
  }
  if (!isGm && !isOwner) throw new AppError(403, 'You can only delete your own token')

  // Suppression DB, invalidation runtime et broadcast centralisés.
  const io = req.app.get('io')
  await removeTokens(io, [token], battlemap.campaign_id)

  res.json({ success: true })
})

export default router
