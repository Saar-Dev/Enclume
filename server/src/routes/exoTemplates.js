/**
 * exoTemplates.js — API lecture du catalogue ref_exo_templates
 *
 * Monté sous /api/exo-templates dans index.js. Patron repris de equipment.js (GET /api/equipment) :
 * table de référence, lecture gameplay simple, requireAuth suffit — aucune route de mutation pour
 * l'instant (le catalogue est peuplé manuellement en base tant qu'aucun outil d'admin n'est instruit,
 * PLAN_EXOARMURE.md).
 *
 * Routes :
 *   GET /api/exo-templates — liste tous les modèles (colonnes résumé, pour sélecteur)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const templates = await db('ref_exo_templates')
      .select('id', 'name', 'category', 'environment', 'base_exoforce', 'base_blindage', 'manufacturer')
      .orderBy('category')
      .orderBy('name')
    res.json({ templates })
  } catch (err) { next(err) }
})

export default router
