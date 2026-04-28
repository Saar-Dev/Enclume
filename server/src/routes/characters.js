import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { multerUpload, multerGlb } from '../middleware/upload.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'
import { WS } from '../../../shared/events.js'

// ─── Router imbriqué ──────────────────────────────────────────────────────────
// Monté sous /api/campaigns/:campaignId/characters
// Requiert mergeParams pour accéder à req.params.campaignId
const router = Router({ mergeParams: true })

// GET /api/campaigns/:campaignId/characters
// Accessible à tous les membres de la campagne.
// Les joueurs ne voient que les personnages avec visible = true.
// Le GM voit tout, y compris gm_notes.
// Les joueurs ne reçoivent jamais gm_notes — filtrage dans le select.
router.get('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params

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
    'characters.updated_at',
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
// visible = false par défaut — le GM choisit quand révéler le personnage aux joueurs.
router.post('/', requireAuth, requireRole('gm'), async (req, res) => {
  const { campaignId } = req.params
  const { name, user_id, visible = false } = req.body

  if (!name) throw new AppError(400, 'Character name is required')

  let color = '#4A90D9'
  if (user_id) {
    const owner = await db('users').where({ id: user_id }).select('color').first()
    if (!owner) throw new AppError(404, 'User not found')
    color = owner.color

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
      'description', 'gm_notes', 'created_at', 'updated_at',
    ])

  res.status(201).json({ character })
})

export default router

// ─── Router standalone ────────────────────────────────────────────────────────
// Monté sous /api/characters
// Contient uniquement PUT /:id, DELETE /:id et les routes upload.
// Ces routes récupèrent campaign_id depuis le character en base —
// elles n'ont pas besoin du campaignId dans l'URL.
// Même pattern que tokensRouter monté sous /api/tokens.
export const actionsRouter = Router()

// PUT /api/characters/:id
// GM ou propriétaire du personnage (user_id).
// GM : peut modifier tous les champs dont description et gm_notes.
// Owner : peut modifier name, visible et description uniquement. Jamais gm_notes.
actionsRouter.put('/:id', requireAuth, async (req, res) => {
  const character = await db('characters').where({ id: req.params.id }).first()
  if (!character) throw new AppError(404, 'Character not found')

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

  const updates = isGm
    ? { name, visible, color, glb_url, portrait_url, user_id, description, gm_notes }
    : { name, visible, description }

  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k])

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No valid fields to update')
  }

  // Recalcul color si user_id change — GM uniquement (user_id absent des updates joueur)
  // Désassignation (null) → couleur PNJ par défaut
  // Nouvelle assignation → couleur du nouveau propriétaire
  if ('user_id' in updates) {
    if (updates.user_id === null) {
      updates.color = '#4A90D9'
    } else {
      const owner = await db('users').where({ id: updates.user_id }).select('color').first()
      if (!owner) throw new AppError(404, 'User not found')
      updates.color = owner.color
    }
  }

  // updated_at systématique sur tout PUT
  updates.updated_at = db.fn.now()

  const [updated] = await db('characters')
    .where({ id: req.params.id })
    .update(updates)
    .returning(['id'])

  const updatedCharacter = await db('characters')
    .where({ 'characters.id': updated.id })
    .leftJoin('users', 'characters.user_id', 'users.id')
    .select(
      'characters.id',
      'characters.campaign_id',
      'characters.user_id',
      'characters.name',
      'characters.color',
      'characters.visible',
      'characters.glb_url',
      'characters.portrait_url',
      'characters.description',
      'characters.gm_notes',
      'characters.created_at',
      'characters.updated_at',
      'users.username as owner_username'
    )
    .first()

  // Broadcaster CHARACTER_UPDATED à toute la room — le serveur est seul émetteur.
  // gm_notes filtré avant broadcast — jamais envoyé aux joueurs.
  // updated_at inclus dans characterPublic — cohérence avec TOKEN_MOVED.
  const { gm_notes: _gm_notes, ...characterPublic } = updatedCharacter
  const io = req.app.get('io')
  io.to(updatedCharacter.campaign_id).emit(WS.CHARACTER_UPDATED, characterPublic)

  res.json({ character: updatedCharacter })
})

// DELETE /api/characters/:id
// GM uniquement.
actionsRouter.delete('/:id', requireAuth, async (req, res) => {
  const character = await db('characters').where({ id: req.params.id }).first()
  if (!character) throw new AppError(404, 'Character not found')

  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: req.user.id })
    .first()
  if (!member || member.role !== 'gm') {
    throw new AppError(403, 'GM role required to delete a character')
  }

  await db('characters').where({ id: req.params.id }).delete()
  res.json({ message: 'Character deleted' })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Relit le character complet avec LEFT JOIN users et broadcaste CHARACTER_UPDATED.
// Factorisé car utilisé par les deux routes upload.
async function broadcastCharacterUpdate(characterId, app) {
  const updatedCharacter = await db('characters')
    .where({ 'characters.id': characterId })
    .leftJoin('users', 'characters.user_id', 'users.id')
    .select(
      'characters.id',
      'characters.campaign_id',
      'characters.user_id',
      'characters.name',
      'characters.color',
      'characters.visible',
      'characters.glb_url',
      'characters.portrait_url',
      'characters.description',
      'characters.gm_notes',
      'characters.created_at',
      'characters.updated_at',
      'users.username as owner_username'
    )
    .first()

  const { gm_notes: _gm_notes, ...characterPublic } = updatedCharacter
  const io = app.get('io')
  io.to(updatedCharacter.campaign_id).emit(WS.CHARACTER_UPDATED, characterPublic)

  return updatedCharacter
}

// POST /api/characters/:id/portrait
// Upload d'une image d'illustration vers MinIO.
// Accessible au GM et au propriétaire du character.
// L'image est stockée sous characters/<id>/illustration (nom fixe, sans extension).
// Le Content-Type est stocké dans les metadata MinIO — assets.js l'utilise pour la réponse.
// portrait_url stocke le chemin MinIO (objectName) — pas une URL complète.
// L'URL d'affichage côté client : ${VITE_API_URL}/api/assets/${character.portrait_url}
actionsRouter.post('/:id/portrait',
  requireAuth,
  multerUpload.single('portrait'),
  async (req, res) => {
    const character = await db('characters').where({ id: req.params.id }).first()
    if (!character) throw new AppError(404, 'Character not found')

    const member = await db('campaign_members')
      .where({ campaign_id: character.campaign_id, user_id: req.user.id })
      .first()
    if (!member) throw new AppError(403, 'You are not a member of this campaign')

    const isGm = member.role === 'gm'
    const isOwner = character.user_id && character.user_id === req.user.id

    if (!isGm && !isOwner) {
      throw new AppError(403, 'You do not have permission to upload a portrait for this character')
    }

    if (!req.file) throw new AppError(400, 'No file uploaded')

    // Nom fixe — putObject écrase l'ancien automatiquement (même clé MinIO).
    // Pas d'extension : Content-Type transmis dans les metadata, lu par assets.js.
    const objectName = `characters/${req.params.id}/illustration`
    const minio = getMinioClient()

    await minio.putObject(
      BUCKET(),
      objectName,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    )

    await db('characters')
      .where({ id: req.params.id })
      .update({ portrait_url: objectName, updated_at: db.fn.now() })

    const updatedCharacter = await broadcastCharacterUpdate(req.params.id, req.app)
    res.json({ character: updatedCharacter })
  }
)

// POST /api/characters/:id/glb
// Upload d'un modèle 3D GLB vers MinIO.
// Accessible au GM uniquement (asset technique).
// Le modèle est stocké sous characters/<id>/model3D (nom fixe, sans extension).
// glb_url stocke le chemin MinIO avec ?v=<timestamp> pour le cache busting de useGLTF.
// L'URL d'affichage côté client : ${VITE_API_URL}/api/assets/${character.glb_url}
// (assets.js ignore les query params lors de la construction du filePath MinIO)
actionsRouter.post('/:id/glb',
  requireAuth,
  multerGlb.single('glb'),
  async (req, res) => {
    const character = await db('characters').where({ id: req.params.id }).first()
    if (!character) throw new AppError(404, 'Character not found')

    const member = await db('campaign_members')
      .where({ campaign_id: character.campaign_id, user_id: req.user.id })
      .first()
    if (!member) throw new AppError(403, 'You are not a member of this campaign')

    if (member.role !== 'gm') {
      throw new AppError(403, 'GM role required to upload a 3D model')
    }

    if (!req.file) throw new AppError(400, 'No file uploaded')

    // Nom fixe — putObject écrase l'ancien automatiquement (même clé MinIO).
    const objectName = `characters/${req.params.id}/model3D`
    const minio = getMinioClient()

    await minio.putObject(
      BUCKET(),
      objectName,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': 'model/gltf-binary' }
    )

    // Timestamp pour cache busting de useGLTF côté client.
    // La valeur stockée en base inclut le ?v= — l'URL proxy assets.js ignore les query params.
    const glbUrl = `${objectName}?v=${Date.now()}`

    await db('characters')
      .where({ id: req.params.id })
      .update({ glb_url: glbUrl, updated_at: db.fn.now() })

    const updatedCharacter = await broadcastCharacterUpdate(req.params.id, req.app)
    res.json({ character: updatedCharacter })
  }
)