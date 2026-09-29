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
 * Filtrage par source (migration 369-375, PLAN_SUPPLEMENTS.md §2.4/§6.10) : `GET /` accepte un
 * `?characterId=` optionnel. Fourni, la campagne du personnage est résolue CÔTÉ SERVEUR (jamais un
 * `campaignId` transmis directement par le client — un utilisateur pourrait sinon prétendre
 * appartenir à n'importe quelle campagne) et seuls les modèles `is_core` ou d'une source activée
 * pour cette campagne sont renvoyés. Sans lui, comportement historique inchangé : liste complète, non
 * filtrée — c'est le chemin emprunté par exo-templates-tool.html, qui gère tout le catalogue.
 *
 * Routes :
 *   GET  /api/exo-templates             — liste les modèles (colonnes résumé, pour sélecteur),
 *                                          filtrée par source active si ?characterId= est fourni
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
    const { characterId } = req.query

    const query = db('ref_exo_templates as t')
      .join('ref_sources as s', 's.id', 't.source_id')
      .select(
        't.id', 't.name', 't.category', 't.environment', 't.base_exoforce', 't.base_blindage',
        't.manufacturer', 't.illustration_url',
        's.id as source_id', 's.code as source_code', 's.name as source_name',
      )
      .orderBy('t.category')
      .orderBy('t.name')

    if (characterId) {
      const character = await db('characters').where({ id: characterId }).first()
      if (!character) throw new AppError(404, 'Character not found')

      query.where(function () {
        this.where('s.is_core', true).orWhereExists(
          db('campaign_enabled_sources')
            .whereRaw('campaign_enabled_sources.source_id = s.id')
            .andWhere('campaign_enabled_sources.campaign_id', character.campaign_id),
        )
      })
    }

    const templates = await query
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
