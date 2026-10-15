import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'
import { signAssetFieldsMiddleware } from '../lib/assetUrlSigning.js'

const router = Router()

// Signe `image_url` avant l'envoi (champ déjà reconnu, ASSET_URL_FIELDS) — THREE.TextureLoader
// (ImageLoader, crossOrigin='anonymous' par défaut) n'envoie jamais le cookie de session dès que
// le port client/serveur diffère (dev ET Kiwi) ; seul un <img src> brut s'en sortirait avec le
// cookie seul (assetUrlSigning.js, déjà vécu ailleurs — WALL-DECAL-IMAGE-NOT-LOADING, trouvaille
// de Saar 2026-10-15 : vignettes et rendu 3D restaient vides, `getFileUrl` pointait une URL MinIO
// directe, jamais servie par l'app — aucune route ne proxyfiait `getFileUrl`, contrairement à
// `/api/assets/*filePath` déjà utilisé pour tout le reste (GLB, portraits, textures)).
router.use(signAssetFieldsMiddleware())

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

    // `image_url` : chemin relatif PUR (`decals/<uuid>.png`), signé par le middleware ci-dessus —
    // le client reconstruit l'URL complète via `/api/assets/`, même convention que `modelGlbUrl`
    // (connecteurs) et tous les autres champs de ASSET_URL_FIELDS, jamais une URL déjà construite.
    const assets = rows.map(row => ({
      ...row,
      image_url: row.image_path,
      ratio: row.width_px / row.height_px,
    }))

    res.json({ assets })
  } catch (err) {
    next(err)
  }
})

export default router
