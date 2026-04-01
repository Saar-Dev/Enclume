import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'

const router = Router({ mergeParams: true })

// GET /api/campaigns/:campaignId/characters
// Accessible à tous les membres de la campagne.
// Les joueurs ne voient que les personnages avec visible = true.
// Le GM voit tout, y compris gm_notes.
// Les joueurs ne reçoivent jamais gm_notes — filtrage dans le select.
router.get('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params

  // Vérifier que l'utilisateur est membre de la campagne
  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'You are not a member of this campaign')

  const isGm = member.role === 'gm'

  // Colonnes communes à tous les rôles
  const columns = [
    'characters.id',
    'characters.name',
    'characters.color',
    'characters.visible',
    'characters.glb_url',
    'characters.portrait_url',
    'characters.user_id',
    'characters.description',
    'characters.created_at',
    'users.username as owner_username',
  ]

  // gm_notes jamais envoyé aux joueurs
  if (isGm) columns.push('characters.gm_notes')

  const query = db('characters')
    .where({ 'characters.campaign_id': campaignId })
    .leftJoin('users', 'characters.user_id', 'users.id')
    .select(columns)
    .orderBy('characters.created_at', 'asc')

  // Les joueurs ne voient pas les personnages masqués
  if (!isGm) query.where('characters.visible', true)

  const characters = await query
  res.json({ characters })
})

// POST /api/campaigns/:campaignId/characters
// GM uniquement. La couleur est héritée du user_id si fourni (PJ),
// sinon couleur par défaut (PNJ/entité GM).
router.post('/', requireAuth, requireRole('gm'), async (req, res) => {
  const { campaignId } = req.params
  const { name, user_id, visible = true } = req.body

  if (!name) throw new AppError(400, 'Character name is required')

  // Si un user_id est fourni (PJ), hériter la couleur du joueur
  let color = '#4A90D9'
  if (user_id) {
    const owner = await db('users').where({ id: user_id }).select('color').first()
    if (!owner) throw new AppError(404, 'User not found')
    color = owner.color

    // Vérifier que ce joueur est bien membre de la campagne
    const ownerMember = await db('campaign_members')
      .where({ campaign_id: campaignId, user_id })
      .first()
    if (!ownerMember) throw new AppError(400, 'This user is not a member of this campaign')
  }

  const [character] = await db('characters')
    .insert({ campaign_id: campaignId, user_id: user_id || null, name, color, visible })
    .returning([
      'id', 'campaign_id', 'user_id', 'name', 'color',
      'visible', 'glb_url', 'portrait_url',
      'description', 'gm_notes', 'created_at',
    ])

  res.status(201).json({ character })
})

// PUT /api/characters/:id
// GM ou propriétaire du personnage (user_id).
// GM : peut modifier tous les champs dont description et gm_notes.
// Owner : peut modifier name, visible et description uniquement. Jamais gm_notes.
router.put('/:id', requireAuth, async (req, res) => {
  const character = await db('characters').where({ id: req.params.id }).first()
  if (!character) throw new AppError(404, 'Character not found')

  // Vérifier que l'utilisateur est membre de la campagne
  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'You are not a member of this campaign')

  const isGm = member.role === 'gm'
  const isOwner = character.user_id && character.user_id === req.user.id

  if (!isGm && !isOwner) {
    throw new AppError(403, 'You do not have permission to modify this character')
  }

  const { name, visible, color, glb_url, portrait_url, user_id, description, gm_notes } = req.body

  // Champs autorisés selon le rôle
  const updates = isGm
    ? { name, visible, color, glb_url, portrait_url, user_id, description, gm_notes }
    : { name, visible, description }

  // Retirer les champs undefined pour ne pas écraser avec null
  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k])

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No valid fields to update')
  }

  const [updated] = await db('characters')
    .where({ id: req.params.id })
    .update(updates)
    .returning([
      'id', 'campaign_id', 'user_id', 'name', 'color',
      'visible', 'glb_url', 'portrait_url',
      'description', 'gm_notes', 'created_at',
    ])

  res.json({ character: updated })
})

// DELETE /api/characters/:id
// GM uniquement.
router.delete('/:id', requireAuth, async (req, res) => {
  const character = await db('characters').where({ id: req.params.id }).first()
  if (!character) throw new AppError(404, 'Character not found')

  // Vérifier que l'utilisateur est GM de la campagne
  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: req.user.id })
    .first()
  if (!member || member.role !== 'gm') {
    throw new AppError(403, 'GM role required to delete a character')
  }

  await db('characters').where({ id: req.params.id }).delete()
  res.json({ message: 'Character deleted' })
})

export default router