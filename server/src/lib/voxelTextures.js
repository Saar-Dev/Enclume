import { Router } from 'express'
import crypto from 'crypto'
import { imageSize } from 'image-size'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'
import { multerUpload } from '../middleware/upload.js'
import { AppError } from '../lib/AppError.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// Noms de faces valides — ordre sans importance ici, validation uniquement
const VALID_FACES = ['principal', 'top', 'bottom', 'north', 'south', 'east', 'west']

// Champs multer : principal obligatoire + 6 faces optionnelles
const uploadFaces = multerUpload.fields(
  VALID_FACES.map(name => ({ name, maxCount: 1 }))
)

// ─── GET /api/voxel-textures ──────────────────────────────────────────────────
// GET /api/voxel-textures — toutes les textures non deprecated (palette éditeur)
// GET /api/voxel-textures?ids=1,3,7 — textures par IDs (Canvas3D au chargement battlemap)
//
// Inclut category_label via LEFT JOIN texture_pack_categories — utilisé par la palette Sidebar.
// legacy_block_type_id non exposée — P35.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    let query = db('voxel_textures')
      .join('texture_packs', 'voxel_textures.pack_id', 'texture_packs.id')
      .leftJoin('texture_pack_categories', 'voxel_textures.category_id', 'texture_pack_categories.id')
      .select(
        'voxel_textures.id',
        'voxel_textures.pack_id',
        'voxel_textures.label',
        'voxel_textures.faces',
        'voxel_textures.allowed_geometries',
        'voxel_textures.deprecated',
        'voxel_textures.sort_order',
        'voxel_textures.category_id',
        'texture_packs.name as pack_name',
        'texture_packs.tile_size',
        'texture_pack_categories.label as category_label',
        'texture_pack_categories.sort_order as category_sort_order',
      )

    if (req.query.ids) {
      // Mode Canvas3D — IDs spécifiques uniquement
      // Pas de filtre deprecated — Canvas3D doit afficher les voxels existants même si deprecated
      const ids = req.query.ids.split(',').map(Number).filter(Boolean)
      query = query.whereIn('voxel_textures.id', ids)
    } else {
      // Mode palette — toutes les textures non deprecated, ordonnées par catégorie puis sort_order
      query = query.where({ 'voxel_textures.deprecated': false })
        .orderBy([
          { column: 'texture_pack_categories.sort_order', order: 'asc', nulls: 'last' },
          { column: 'voxel_textures.sort_order', order: 'asc' },
        ])
    }

    const textures = await query
    res.json({ textures })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/voxel-textures ─────────────────────────────────────────────────
// Crée une nouvelle texture avec upload PNG (principal obligatoire + 6 faces optionnelles).
// Ownership : seul le créateur du pack peut ajouter des textures.
// Ordre d'écriture : MinIO AVANT base (P25).
router.post('/', requireAuth, uploadFaces, async (req, res, next) => {
  try {
    const { pack_id, label, category_id, allowed_geometries, sort_order } = req.body

    if (!pack_id) throw new AppError(400, 'pack_id requis')
    if (!label)   throw new AppError(400, 'label requis')

    // Vérifier que le pack existe et appartient à l'utilisateur
    const pack = await db('texture_packs').where({ id: pack_id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')
    if (pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    // Vérifier le fichier principal obligatoire
    const principalFile = req.files?.['principal']?.[0]
    if (!principalFile) throw new AppError(400, 'Fichier principal requis')

    // Plafond 9999 textures par pack
    const [{ count }] = await db('voxel_textures').where({ pack_id }).count('id as count')
    if (Number(count) >= 9999) throw new AppError(400, 'Plafond de 9999 textures atteint pour ce pack')

    // Valider et uploader chaque fichier présent (MinIO AVANT base — P25)
    const minio = getMinioClient()
    const bucket = BUCKET()
    const faces = {}

    for (const faceName of VALID_FACES) {
      const file = req.files?.[faceName]?.[0]
      if (!file) continue

      // Validation dimensions — multiples de tile_size
      const { width, height } = imageSize(file.buffer)
      if (width % pack.tile_size !== 0 || height % pack.tile_size !== 0) {
        throw new AppError(400,
          `Fichier "${faceName}" : dimensions ${width}×${height} non multiples de tile_size (${pack.tile_size}px)`
        )
      }

      // Chemin MinIO : textures/<pack_id>/<uuid>.png — stable au renommage du pack
      const uuid = crypto.randomUUID()
      const objectName = `textures/${pack_id}/${uuid}.png`

      await minio.putObject(bucket, objectName, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      })

      // Chemin relatif au pack stocké dans faces (pas le chemin MinIO complet)
      const relativePath = `${uuid}.png`

      if (faceName === 'principal') {
        // Principal = fallback pour toutes les faces non définies
        faces.all = relativePath
      } else {
        faces[faceName] = relativePath
      }
    }

    // Parser allowed_geometries (string JSON ou null)
    let parsedGeometries = null
    if (allowed_geometries) {
      try {
        parsedGeometries = JSON.parse(allowed_geometries)
      } catch {
        throw new AppError(400, 'allowed_geometries doit être un tableau JSON valide ou null')
      }
    }

    // INSERT en base — après upload MinIO réussi (P25)
    const [texture] = await db('voxel_textures').insert({
      pack_id,
      label,
      faces: JSON.stringify(faces),
      category_id:         category_id || null,
      allowed_geometries:  parsedGeometries ? JSON.stringify(parsedGeometries) : null,
      sort_order:          sort_order ? Number(sort_order) : 0,
      deprecated:          false,
    }).returning('*')

    res.status(201).json({ texture })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/voxel-textures/:id ─────────────────────────────────────────────
// Modifie les métadonnées d'une texture existante.
// Ne modifie pas les fichiers PNG — uniquement label, deprecated, allowed_geometries,
// sort_order, category_id.
// Ownership : seul le créateur du pack peut modifier ses textures.
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const texture = await db('voxel_textures').where({ id: req.params.id }).first()
    if (!texture) throw new AppError(404, 'Texture introuvable')

    // Vérifier ownership via le pack
    const pack = await db('texture_packs').where({ id: texture.pack_id }).first()
    if (!pack || pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    const { label, deprecated, allowed_geometries, sort_order, category_id } = req.body

    const updates = {}
    if (label       !== undefined) updates.label       = label
    if (deprecated  !== undefined) updates.deprecated  = deprecated
    if (sort_order  !== undefined) updates.sort_order  = Number(sort_order)
    if (category_id !== undefined) updates.category_id = category_id || null

    if (allowed_geometries !== undefined) {
      if (allowed_geometries === null || allowed_geometries === '') {
        updates.allowed_geometries = null
      } else {
        try {
          const parsed = JSON.parse(allowed_geometries)
          updates.allowed_geometries = JSON.stringify(parsed)
        } catch {
          throw new AppError(400, 'allowed_geometries doit être un tableau JSON valide ou null')
        }
      }
    }

    if (Object.keys(updates).length === 0) throw new AppError(400, 'Aucun champ à modifier')
    updates.updated_at = db.fn.now()

    const [updated] = await db('voxel_textures')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*')

    res.json({ texture: updated })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/voxel-textures/:id ──────────────────────────────────────────
// Supprime une texture.
// 409 si la texture est utilisée dans au moins une battlemap (battlemap_texture_usage).
// Ownership : seul le créateur du pack peut supprimer ses textures.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const texture = await db('voxel_textures').where({ id: req.params.id }).first()
    if (!texture) throw new AppError(404, 'Texture introuvable')

    // Vérifier ownership via le pack
    const pack = await db('texture_packs').where({ id: texture.pack_id }).first()
    if (!pack || pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    // Guard 409 — P42 : battlemap_texture_usage (jamais battlemap_block_usage)
    const usages = await db('battlemap_texture_usage')
      .where({ voxel_texture_id: req.params.id })
    if (usages.length > 0) {
      return res.status(409).json({
        error: 'Texture utilisée dans des battlemaps — marquer comme dépréciée plutôt que supprimer',
        battlemapIds: usages.map(u => u.battlemap_id),
      })
    }

    await db('voxel_textures').where({ id: req.params.id }).delete()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router