/**
 * exoTemplates.js — API lecture + illustration du catalogue ref_exo_templates
 *
 * Monté sous /api/exo-templates dans index.js. Patron repris de equipment.js (GET /api/equipment) :
 * table de référence, lecture gameplay simple, requireAuth suffit.
 *
 * POST /:id/illustration (migration 263, PLAN_EXOARMURE.md §15) — même mécanique que
 * POST /api/characters/:id/portrait (characters.js) : upload MinIO à clé fixe + cache-bust par
 * timestamp, mais gardé requireAdmin (catalogue partagé, pas une fiche de joueur — même garde que le
 * CRUD ref_equipment, equipment.js) plutôt que isGm/isOwner.
 *
 * Routes :
 *   GET  /api/exo-templates             — liste tous les modèles (colonnes résumé, pour sélecteur)
 *   POST /api/exo-templates/:id/illustration — upload l'illustration d'un modèle (admin)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { multerUpload } from '../middleware/upload.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const templates = await db('ref_exo_templates')
      .select('id', 'name', 'category', 'environment', 'base_exoforce', 'base_blindage', 'manufacturer', 'illustration_url')
      .orderBy('category')
      .orderBy('name')
    res.json({ templates })
  } catch (err) { next(err) }
})

router.post('/:id/illustration', requireAuth, requireAdmin, multerUpload.single('illustration'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded')

    // Nom fixe — putObject écrase l'ancien automatiquement (même clé MinIO), même patron que
    // characters.js POST /:id/portrait.
    const objectName = `exo_templates/${req.params.id}/illustration`
    const minio = getMinioClient()

    await minio.putObject(
      BUCKET(),
      objectName,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    )

    const illustrationUrl = `${objectName}?v=${Date.now()}`

    const [template] = await db('ref_exo_templates')
      .where({ id: req.params.id })
      .update({ illustration_url: illustrationUrl, updated_at: db.fn.now() })
      .returning(['id', 'name', 'illustration_url'])

    if (!template) throw new AppError(404, 'Modèle exo-armure introuvable')

    res.json({ template })
  } catch (err) { next(err) }
})

export default router
