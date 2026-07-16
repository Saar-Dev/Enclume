import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { multerUpload, multerGlb } from '../middleware/upload.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'
import { WS } from '../../../shared/events.js'
import { WOUND_MAX_COUNTS } from '../../../shared/woundConstants.js'
import { initDamages } from '../../../shared/droneConstants.js'
import { removeTokens } from '../lib/tokenLifecycle.js'
import { createEmptySheet } from '../services/charSheetService.js'
import { resolveOwnership } from '../services/characterOwnershipService.js'

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
    'characters.type',
    'characters.color',
    'characters.visible',
    'characters.glb_url',
    'characters.portrait_url',
    'characters.user_id',
    'characters.description',
    'characters.created_at',
    'characters.updated_at',
    'users.username as owner_username',
    db.raw(`(
      SELECT cw.severity
      FROM character_wounds cw
      INNER JOIN char_sheet cs ON cs.id = cw.char_sheet_id
      WHERE cs.character_id = characters.id
      ORDER BY CASE cw.severity
        WHEN 'mortelle' THEN 1 WHEN 'critique' THEN 2 WHEN 'grave' THEN 3
        WHEN 'moyenne'  THEN 4 WHEN 'legere'   THEN 5 END
      LIMIT 1
    ) as worst_wound_severity`),
  ]

  // gm_notes jamais envoyé aux joueurs
  if (isGm) columns.push('characters.gm_notes')

  const query = db('characters')
    .where({ 'characters.campaign_id': campaignId })
    .leftJoin('users', 'characters.user_id', 'users.id')
    .select(columns)
    .orderBy('characters.created_at', 'asc')

  // Brouillons wizard cachés pour tout le monde tant que le Wizard n'est pas verrouillé.
  // INVARIANT (voir reconcileCreation isComplete dans creationService.js) : un personnage
  // peut être visible=true dès la fin de l'étape 5 alors que le joueur navigue encore
  // librement dans le Wizard (retour arrière possible) — ça ne fuit nulle part
  // UNIQUEMENT parce que ce filtre gate sur wizard_locked_at, pas sur visible ni
  // creation_state. Le regater sur creation_state/visible rouvrirait silencieusement
  // cette fenêtre d'exposition (GM éditant un personnage encore en cours de construction).
  query.whereNotExists(function () {
    this.select(db.raw('1'))
      .from('char_sheet')
      .whereRaw('char_sheet.character_id = characters.id')
      .whereNull('char_sheet.wizard_locked_at')
  })

  // Les joueurs ne voient pas non plus les personnages masqués
  if (!isGm) {
    query.where('characters.visible', true)
  }

  const characters = await query
  res.json({ characters })
})

// POST /api/campaigns/:campaignId/characters
// GM uniquement. type/couleur dérivés de l'appartenance réelle du propriétaire
// (resolveOwnership — docs/PLAN_CHARACTER_SERVICE.md) : un personnage assigné
// au GM lui-même reste PNJ, seul un membre role='player' donne PJ.
// visible = false par défaut — le GM choisit quand révéler le personnage aux joueurs.
router.post('/', requireAuth, requireRole('gm'), async (req, res) => {
  const { campaignId } = req.params
  const { name, user_id, visible = false, type: typeOverride } = req.body

  if (!name) throw new AppError(400, 'Character name is required')

  const ownership = await resolveOwnership(db, { campaignId, userId: user_id })
  const color = ownership.color
  const type = typeOverride === 'drone' ? 'drone' : ownership.type

  // Transaction unique : le personnage et sa fiche (char_sheet ou drone_sheet) naissent
  // ensemble — jamais de personnage sans fiche, jamais de fenêtre de course à la
  // création lazy (cf. commentaire migration 132_char_sheet_dedupe_and_unique.js).
  const character = await db.transaction(async (trx) => {
    const [character] = await trx('characters')
      .insert({ campaign_id: campaignId, user_id: ownership.user_id, name, color, visible, type })
      .returning([
        'id', 'campaign_id', 'user_id', 'type', 'name', 'color',
        'visible', 'glb_url', 'portrait_url',
        'description', 'gm_notes', 'created_at', 'updated_at',
      ])

    if (type === 'drone') {
      const damages = initDamages('corps', WOUND_MAX_COUNTS)
      await trx('drone_sheet').insert({ character_id: character.id, damages: JSON.stringify(damages) })
    } else {
      await createEmptySheet(trx, character.id)
    }

    return character
  })

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

  // Recalcul type/color si user_id change — GM uniquement (user_id absent des updates joueur).
  // resolveOwnership dérive depuis campaign_members.role (docs/PLAN_CHARACTER_SERVICE.md) :
  // color toujours réappliquée, type seulement si le personnage n'est pas un drone (un drone
  // garde son type quelle que soit l'assignation).
  if ('user_id' in updates) {
    const ownership = await resolveOwnership(db, { campaignId: character.campaign_id, userId: updates.user_id })
    updates.color = ownership.color
    if (character.type !== 'drone') updates.type = ownership.type
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
      'characters.type',
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

  // Supprimer d'abord les tokens de ce character sur tous les battlemaps (sinon ils restent
  // sur la carte sans fiche liée, char_id passé à NULL par la FK, mais toujours dans combat_roster)
  const tokens = await db('tokens')
    .select('id', 'battlemap_id', 'pos_x', 'pos_y', 'pos_z', 'layer')
    .where({ character_id: req.params.id })
  if (tokens.length) {
    const io = req.app.get('io')
    await removeTokens(io, tokens, character.campaign_id)
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
      'characters.type',
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

    if (member.role !== 'gm' && character.user_id !== req.user.id) {
      throw new AppError(403, 'GM role or character ownership required to upload a 3D model')
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