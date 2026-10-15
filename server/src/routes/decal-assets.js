import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'
import { getFileUrl } from '../lib/minio.js'

const router = Router()

// ─── GET /api/decal-assets ─────────────────────────────────────────────────
// Catalogue des décalques non dépréciés (palette de l'outil de pose, Lot 3). Lecture seule —
// aucune écriture tant que l'import/l'upload depuis l'éditeur n'est pas en périmètre (v2,
// PLAN_DECALS.md Lot 0 « Hors périmètre »).
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await db('decal_assets')
      .where({ deprecated: false })
      .orderBy(['category', 'sort_order', 'label'])
      .select('id', 'category', 'label', 'image_path', 'width_px', 'height_px', 'source_pack')

    const assets = rows.map(row => ({
      ...row,
      url: getFileUrl(row.image_path),
      ratio: row.width_px / row.height_px,
    }))

    res.json({ assets })
  } catch (err) {
    next(err)
  }
})

export default router
