import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/block-types — tous les blocs non deprecated (palette éditeur)
// GET /api/block-types?ids=1,3,7 — blocs par IDs (Canvas3D au chargement battlemap)
//
// Inclut category_label via LEFT JOIN texture_pack_categories — utilisé par la palette Sidebar.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    let query = db('block_types')
      .join('texture_packs', 'block_types.pack_id', 'texture_packs.id')
      .leftJoin('texture_pack_categories', 'block_types.category_id', 'texture_pack_categories.id')
      .select(
        'block_types.id',
        'block_types.pack_id',
        'block_types.label',
        'block_types.geometry',
        'block_types.textures',
        'block_types.deprecated',
        'block_types.sort_order',
        'block_types.category_id',
        'texture_packs.name as pack_name',
        'texture_packs.tile_size',
        'texture_pack_categories.label as category_label',
        'texture_pack_categories.sort_order as category_sort_order',
      )

    if (req.query.ids) {
      // Mode Canvas3D — IDs spécifiques uniquement
      const ids = req.query.ids.split(',').map(Number).filter(Boolean)
      query = query.whereIn('block_types.id', ids)
    } else {
      // Mode palette — tous les blocs non deprecated, ordonnés par catégorie puis sort_order
      query = query.where({ 'block_types.deprecated': false })
        .orderBy([
          { column: 'texture_pack_categories.sort_order', order: 'asc', nulls: 'last' },
          { column: 'block_types.sort_order', order: 'asc' },
        ])
    }

    const blocks = await query
    res.json({ blocks })
  } catch (err) {
    next(err)
  }
})

export default router
