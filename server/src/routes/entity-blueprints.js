import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { multerGlb } from '../middleware/upload.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// ─── GET /api/entity-blueprints ───────────────────────────────────────────────
// Liste tous les blueprints non-deprecated.
// Accessible à tout utilisateur authentifié.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const blueprints = await db('entity_blueprints')
      .where({ deprecated: false })
      .select('*')
      .orderBy('created_at', 'asc')
    res.json({ blueprints })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/entity-blueprints/all ──────────────────────────────────────────
// Liste tous les blueprints y compris deprecated — pour l'interface de gestion GM.
// ?pack_id=<uuid> : filtre par pack (optionnel) — sans ce paramètre = tous les blueprints.
// Route spécifique déclarée AVANT /:id pour éviter qu'Express l'interprète comme un id (P46).
router.get('/all', requireAuth, async (req, res, next) => {
  try {
    let query = db('entity_blueprints')
      .select('*')
      .orderBy('created_at', 'asc')
    if (req.query.pack_id) {
      query = query.where({ pack_id: req.query.pack_id })
    }
    const blueprints = await query
    res.json({ blueprints })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/entity-blueprints/:id ──────────────────────────────────────────
// Détail d'un blueprint.
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const blueprint = await db('entity_blueprints')
      .where({ id: req.params.id })
      .first()
    if (!blueprint) throw new AppError(404, 'Blueprint introuvable')
    res.json({ blueprint })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/entity-blueprints ─────────────────────────────────────────────
// Créer un nouveau blueprint.
// Tout utilisateur authentifié peut créer un blueprint (ownership via created_by).
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { label, glb_url, geometry, states, interactions, pack_id } = req.body

    if (!label || !label.trim()) throw new AppError(400, 'Le label est obligatoire')

    const [blueprint] = await db('entity_blueprints')
      .insert({
        created_by: req.user.id,
        label: label.trim(),
        glb_url: glb_url || null,
        geometry: JSON.stringify(geometry || {}),
        states: JSON.stringify(states || []),
        interactions: JSON.stringify(interactions || []),
        deprecated: false,
        pack_id: pack_id || null,   // nullable — PE18 : guard côté client avant accès
      })
      .returning('*')

    res.status(201).json({ blueprint })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/entity-blueprints/:id ──────────────────────────────────────────
// Modifier un blueprint existant.
// Seul le créateur peut modifier (created_by === req.user.id).
// ⚠️ Modification d'un blueprint sans effet rétroactif sur les instances déjà posées.
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const blueprint = await db('entity_blueprints')
      .where({ id: req.params.id })
      .first()
    if (!blueprint) throw new AppError(404, 'Blueprint introuvable')
    if (blueprint.created_by !== req.user.id) throw new AppError(403, 'Non autorisé')

    const { label, glb_url, geometry, states, interactions, deprecated, pack_id } = req.body

    const updates = {}
    if (label        !== undefined) updates.label        = label.trim()
    if (glb_url      !== undefined) updates.glb_url      = glb_url || null
    if (geometry     !== undefined) updates.geometry     = JSON.stringify(geometry)
    if (states       !== undefined) updates.states       = JSON.stringify(states)
    if (interactions !== undefined) updates.interactions = JSON.stringify(interactions)
    if (deprecated   !== undefined) updates.deprecated   = deprecated
    if (pack_id      !== undefined) updates.pack_id      = pack_id || null
    // pack_id nullable — PE18 : blueprints legacy peuvent avoir pack_id = null

    if (Object.keys(updates).length === 0) {
      return res.json({ blueprint })
    }

    // updated_at après le guard Object.keys — P13
    updates.updated_at = db.fn.now()

    const [updated] = await db('entity_blueprints')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*')

    res.json({ blueprint: updated })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/entity-blueprints/:id/upload-glb ──────────────────────────────
// Upload d'un modèle GLB pour un blueprint.
// Seul le créateur peut uploader.
// Stocké dans MinIO sous glb/<blueprint_id>.glb
// glb_url stocke le chemin MinIO avec ?v=<timestamp> pour le cache busting de useGLTF (P19).
router.post('/:id/upload-glb', requireAuth, multerGlb.single('glb'), async (req, res, next) => {
  try {
    const blueprint = await db('entity_blueprints')
      .where({ id: req.params.id })
      .first()
    if (!blueprint) throw new AppError(404, 'Blueprint introuvable')
    if (blueprint.created_by !== req.user.id) throw new AppError(403, 'Non autorisé')
    if (!req.file) throw new AppError(400, 'Fichier GLB requis')

    const objectName = `glb/${req.params.id}.glb`
    const minio = getMinioClient()

    await minio.putObject(
      BUCKET(),
      objectName,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': 'model/gltf-binary' }
    )

    // Timestamp pour cache busting — P19
    const glbUrl = `${objectName}?v=${Date.now()}`

    const [updated] = await db('entity_blueprints')
      .where({ id: req.params.id })
      .update({ glb_url: glbUrl, updated_at: db.fn.now() })
      .returning('*')

    res.json({ blueprint: updated })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/entity-blueprints/:id ───────────────────────────────────────
// Supprimer un blueprint.
// Seul le créateur peut supprimer.
// 409 si des instances existent sur n'importe quelle battlemap — utiliser deprecated à la place.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const blueprint = await db('entity_blueprints')
      .where({ id: req.params.id })
      .first()
    if (!blueprint) throw new AppError(404, 'Blueprint introuvable')
    if (blueprint.created_by !== req.user.id) throw new AppError(403, 'Non autorisé')

    // Vérifier si des instances utilisent ce blueprint
    const instanceCount = await db('entities')
      .where({ blueprint_id: req.params.id })
      .count('id as count')
      .first()

    if (parseInt(instanceCount.count) > 0) {
      throw new AppError(
        409,
        'Ce blueprint est utilisé par des entités posées sur des cartes. ' +
        'Utilisez deprecated=true pour le désactiver sans supprimer les instances existantes.'
      )
    }

    await db('entity_blueprints').where({ id: req.params.id }).delete()

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
