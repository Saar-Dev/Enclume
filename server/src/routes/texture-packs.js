import { Router } from 'express'
import crypto from 'crypto'
import multer from 'multer'
import JSZip from 'jszip'
import { imageSize } from 'image-size'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'
import { multerUpload } from '../middleware/upload.js'
import { AppError } from '../lib/AppError.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// Multer dédié à l'import ZIP — stockage mémoire, filtre MIME zip uniquement
const multerZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new AppError(400, 'Fichier ZIP requis'), false)
    }
  },
})

// Guard path traversal pour les chemins dans le manifest ZIP
// Autorise uniquement : <categorie>/<fichier>.png ou <fichier>.png (racine du pack)
const SAFE_PATH_RE = /^[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)?\.png$/
function assertSafePath(p) {
  if (!SAFE_PATH_RE.test(p)) {
    throw new AppError(400, `Chemin non autorisé dans le manifest : "${p}"`)
  }
}

// Collecte tous les objets sous un préfixe MinIO (stream événementiel)
function listObjects(client, bucket, prefix) {
  return new Promise((resolve, reject) => {
    const objects = []
    const stream = client.listObjectsV2(bucket, prefix, true)
    stream.on('data', obj => objects.push(obj.name))
    stream.on('error', reject)
    stream.on('end', () => resolve(objects))
  })
}

// Lit un objet MinIO et retourne son contenu en Buffer
async function getObjectBuffer(client, bucket, objectName) {
  const stream = await client.getObject(bucket, objectName)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// Génère et stocke le ZIP pré-calculé d'un pack dans MinIO
// Le ZIP contient : manifest.json + tous les PNG du pack
// Appelé après chaque modification du pack ou de ses textures
async function rebuildPackZip(packId) {
  const minio = getMinioClient()
  const bucket = BUCKET()
  const prefix = `textures/${packId}/`

  // Lire le pack et ses textures depuis la base
  const pack = await db('texture_packs').where({ id: packId }).first()
  if (!pack) return

  const categories = await db('texture_pack_categories')
    .where({ pack_id: packId })
    .orderBy('sort_order')

  const textures = await db('voxel_textures')
    .where({ pack_id: packId, deprecated: false })
    .orderBy('sort_order')

  // Construire le manifest au format transport
  const manifest = {
    name:       pack.name,
    label:      pack.label,
    tileSize:   pack.tile_size,
    categories: categories.map(c => ({
      id:         c.id,
      label:      c.label,
      sort_order: c.sort_order,
    })),
    textures: textures.map((t, idx) => ({
      localId:            idx + 1,
      label:              t.label,
      category:           t.category_id,
      faces:              t.faces,
      allowed_geometries: t.allowed_geometries,
      sort_order:         t.sort_order,
    })),
  }

  // Créer le ZIP en mémoire
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // Ajouter tous les PNG existants dans le dossier du pack
  const objects = await listObjects(minio, bucket, prefix)
  const pngObjects = objects.filter(name =>
    name.endsWith('.png') && !name.includes('manifest') && !name.includes('pack_archive')
  )

  for (const objectName of pngObjects) {
    const buffer = await getObjectBuffer(minio, bucket, objectName)
    // Chemin dans le ZIP = chemin relatif au pack (sans le préfixe textures/<packId>/)
    const relativePath = objectName.slice(prefix.length)
    zip.file(relativePath, buffer)
  }

  // Générer le buffer ZIP et l'uploader dans MinIO
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await minio.putObject(
    bucket,
    `${prefix}pack_archive.zip`,
    zipBuffer,
    zipBuffer.length,
    { 'Content-Type': 'application/zip' }
  )

  // Mettre à jour aussi le manifest.json dans MinIO
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
  await minio.putObject(
    bucket,
    `${prefix}manifest.json`,
    manifestBuffer,
    manifestBuffer.length,
    { 'Content-Type': 'application/json' }
  )
}

// ─── GET /api/texture-packs ───────────────────────────────────────────────────
// Liste des packs avec nombre de textures (voxel_textures, pas block_types — P42)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const packs = await db('texture_packs')
      .leftJoin('voxel_textures', 'texture_packs.id', 'voxel_textures.pack_id')
      .select(
        'texture_packs.id',
        'texture_packs.name',
        'texture_packs.label',
        'texture_packs.description',
        'texture_packs.tile_size',
        'texture_packs.created_by',
        'texture_packs.created_at',
        db.raw('count(voxel_textures.id) as texture_count'),
      )
      .groupBy('texture_packs.id')
      .orderBy('texture_packs.created_at', 'asc')

    res.json({ packs })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/texture-packs/:id ───────────────────────────────────────────────
// Détail pack + catégories + textures (voxel_textures, pas block_types — P42)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) return res.status(404).json({ error: 'Pack introuvable' })

    const categories = await db('texture_pack_categories')
      .where({ pack_id: req.params.id })
      .orderBy('sort_order')

    const textures = await db('voxel_textures')
      .where({ pack_id: req.params.id })
      .orderBy('sort_order')

    res.json({ pack, categories, textures })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/texture-packs ──────────────────────────────────────────────────
// Crée un nouveau pack de textures.
// Le pack UUID est généré par Knex (defaultTo knex.fn.uuid()).
// Aucun fichier à l'upload — le pack démarre vide, textures ajoutées via POST /voxel-textures.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, label, description, tile_size } = req.body

    if (!name)  throw new AppError(400, 'name requis')
    if (!label) throw new AppError(400, 'label requis')

    // Vérifier unicité du name
    const existing = await db('texture_packs').where({ name }).first()
    if (existing) throw new AppError(409, `Un pack avec le name "${name}" existe déjà`)

    // INSERT en base — l'UUID est généré par defaultTo(knex.fn.uuid())
    const [pack] = await db('texture_packs').insert({
      name,
      label,
      description: description || null,
      tile_size:   tile_size ? Number(tile_size) : 128,
      created_by:  req.user.id,
    }).returning('*')

    // Générer le ZIP initial (manifest seul, aucune texture encore)
    await rebuildPackZip(pack.id)

    res.status(201).json({ pack })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/texture-packs/:id ───────────────────────────────────────────────
// Modifie les métadonnées du pack : label, description, tile_size uniquement.
// name est immuable après création.
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')
    if (pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    const { label, description, tile_size } = req.body

    const updates = {}
    if (label       !== undefined) updates.label       = label
    if (description !== undefined) updates.description = description || null
    if (tile_size   !== undefined) updates.tile_size   = Number(tile_size)

    if (Object.keys(updates).length === 0) throw new AppError(400, 'Aucun champ à modifier')
    updates.updated_at = db.fn.now()

    const [updated] = await db('texture_packs')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*')

    // Régénérer le ZIP — le manifest contient le label
    await rebuildPackZip(req.params.id)

    res.json({ pack: updated })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/texture-packs/:id ───────────────────────────────────────────
// Supprime un pack et tous ses fichiers MinIO.
// 409 si des textures du pack sont utilisées dans des battlemaps (P42).
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')
    if (pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    // Guard 409 — P42 : battlemap_texture_usage JOIN voxel_textures (jamais block_types)
    const usedTextures = await db('battlemap_texture_usage')
      .join('voxel_textures', 'battlemap_texture_usage.voxel_texture_id', 'voxel_textures.id')
      .where({ 'voxel_textures.pack_id': req.params.id })
      .select('battlemap_texture_usage.battlemap_id', 'voxel_textures.id as texture_id')

    if (usedTextures.length > 0) {
      return res.status(409).json({
        error: 'Pack utilisé dans des battlemaps — impossible de le supprimer',
        battlemapIds: [...new Set(usedTextures.map(u => u.battlemap_id))],
      })
    }

    // Supprimer tous les fichiers MinIO du pack
    const minio = getMinioClient()
    const bucket = BUCKET()
    const objects = await listObjects(minio, bucket, `textures/${req.params.id}/`)
    for (const objectName of objects) {
      await minio.removeObject(bucket, objectName)
    }

    // Supprimer en base (cascade : voxel_textures + texture_pack_categories via FK)
    await db('texture_packs').where({ id: req.params.id }).delete()

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/texture-packs/:id/export ───────────────────────────────────────
// Sert le ZIP pré-calculé depuis MinIO directement — pas de reconstruction à la demande.
router.get('/:id/export', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')

    const minio = getMinioClient()
    const bucket = BUCKET()
    const zipPath = `textures/${req.params.id}/pack_archive.zip`

    let stat
    try {
      stat = await minio.statObject(bucket, zipPath)
    } catch (err) {
      if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
        // ZIP absent — le régénérer à la demande (cas de reprise)
        await rebuildPackZip(req.params.id)
        stat = await minio.statObject(bucket, zipPath)
      } else {
        throw err
      }
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', `attachment; filename="${pack.name}.zip"`)

    const stream = await minio.getObject(bucket, zipPath)
    stream.pipe(res)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/texture-packs/import ──────────────────────────────────────────
// Importe un pack depuis un ZIP (manifest + PNG).
// Ordre : MinIO AVANT base (P25).
// Remapping localId → ID global via returning('id').
// Guard path traversal sur tous les chemins du manifest.
// Plafond 9999 textures vérifié avant INSERT.
router.post('/import', requireAuth, multerZip.single('zip'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'Fichier ZIP requis')

    // Extraire le ZIP en mémoire
    const zip = await JSZip.loadAsync(req.file.buffer)

    // Lire et parser le manifest
    const manifestFile = zip.file('manifest.json')
    if (!manifestFile) throw new AppError(400, 'manifest.json absent du ZIP')

    let manifest
    try {
      const manifestText = await manifestFile.async('string')
      manifest = JSON.parse(manifestText)
    } catch {
      throw new AppError(400, 'manifest.json invalide ou non-JSON')
    }

    // Valider les champs obligatoires du manifest
    if (!manifest.name)      throw new AppError(400, 'manifest.name requis')
    if (!manifest.label)     throw new AppError(400, 'manifest.label requis')
    if (!manifest.textures?.length) throw new AppError(400, 'manifest.textures vide ou absent')

    // Vérifier unicité du name — générer un suffixe si collision
    let packName = manifest.name
    const existing = await db('texture_packs').where({ name: packName }).first()
    if (existing) {
      packName = `${manifest.name}-${Date.now()}`
    }

    // Plafond global — vérifier que l'import ne dépasserait pas 9999
    if (manifest.textures.length > 9999) {
      throw new AppError(400, `Import dépasse le plafond de 9999 textures (${manifest.textures.length} dans le ZIP)`)
    }

    const tileSize = manifest.tileSize || 128

    // Valider les chemins de faces dans le manifest — guard path traversal
    for (const tex of manifest.textures) {
      const faces = tex.faces || {}
      for (const [faceName, facePath] of Object.entries(faces)) {
        if (faceName === 'side') continue // alias rétrocompat P33 — ignoré à l'écriture
        assertSafePath(facePath)
      }
    }

    // 1. Uploader les PNG dans MinIO AVANT tout INSERT en base (P25)
    // UUID du nouveau pack généré maintenant — utilisé comme dossier MinIO
    const newPackId = crypto.randomUUID()
    const minio = getMinioClient()
    const bucket = BUCKET()
    const prefix = `textures/${newPackId}/`

    // Collecter tous les PNG du ZIP et les uploader
    const pngFiles = Object.keys(zip.files).filter(name =>
      name.endsWith('.png') && !zip.files[name].dir
    )

    for (const pngPath of pngFiles) {
      assertSafePath(pngPath) // guard path traversal sur le chemin réel dans le ZIP
      const buffer = await zip.files[pngPath].async('nodebuffer')
      const objectName = `${prefix}${pngPath}`
      await minio.putObject(bucket, objectName, buffer, buffer.length, {
        'Content-Type': 'image/png',
      })
    }

    // 2. INSERT texture_packs en base
    const [pack] = await db('texture_packs').insert({
      id:          newPackId,
      name:        packName,
      label:       manifest.label,
      description: manifest.description || null,
      tile_size:   tileSize,
      created_by:  req.user.id,
    }).returning('*')

    // 3. INSERT texture_pack_categories
    const categoryIdMap = {} // manifest category id → DB UUID
    if (manifest.categories?.length) {
      for (const cat of manifest.categories) {
        const [inserted] = await db('texture_pack_categories').insert({
          pack_id:    newPackId,
          label:      cat.label,
          sort_order: cat.sort_order ?? 0,
        }).returning('id')
        categoryIdMap[cat.id] = inserted.id
      }
    }

    // 4. INSERT voxel_textures avec remapping localId → ID global
    const idMapping = {} // localId → voxel_texture_id global
    for (const tex of manifest.textures) {
      // Résoudre alias 'side' → faces nommées (P33 — alias lecture uniquement)
      const rawFaces = { ...tex.faces }
      if (rawFaces.side) {
        if (!rawFaces.north) rawFaces.north = rawFaces.side
        if (!rawFaces.south) rawFaces.south = rawFaces.side
        if (!rawFaces.east)  rawFaces.east  = rawFaces.side
        if (!rawFaces.west)  rawFaces.west  = rawFaces.side
        delete rawFaces.side
      }

      const categoryDbId = tex.category ? (categoryIdMap[tex.category] || null) : null

      const [inserted] = await db('voxel_textures').insert({
        pack_id:            newPackId,
        category_id:        categoryDbId,
        label:              tex.label,
        faces:              JSON.stringify(rawFaces),
        allowed_geometries: tex.allowed_geometries ? JSON.stringify(tex.allowed_geometries) : null,
        sort_order:         tex.sort_order ?? 0,
        deprecated:         false,
      }).returning('id')

      idMapping[tex.localId] = inserted.id
    }

    // 5. Générer le ZIP pré-calculé
    await rebuildPackZip(newPackId)

    res.status(201).json({
      pack,
      textureCount: manifest.textures.length,
      idMapping,
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/texture-packs/:id/files ────────────────────────────────────────
// Liste tous les PNG bruts du pack dans MinIO.
// Retourne pour chaque PNG : { path, url, inUse }
// inUse = true si le chemin apparaît dans les faces d'au moins une voxel_texture du pack.
router.get('/:id/files', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')

    const minio = getMinioClient()
    const bucket = BUCKET()
    const prefix = `textures/${req.params.id}/`

    // Lister tous les PNG du pack dans MinIO (exclure manifest.json et pack_archive.zip)
    const allObjects = await listObjects(minio, bucket, prefix)
    const pngObjects = allObjects.filter(name =>
      name.endsWith('.png') && !name.includes('pack_archive')
    )

    // Collecter tous les chemins de faces utilisés dans les voxel_textures du pack
    const voxelTextures = await db('voxel_textures').where({ pack_id: req.params.id })
    const usedPaths = new Set()
    for (const vt of voxelTextures) {
      const faces = vt.faces || {}
      for (const facePath of Object.values(faces)) {
        if (typeof facePath === 'string') usedPaths.add(facePath)
      }
    }

    // Construire la liste avec flag inUse
    const files = pngObjects.map(objectName => {
      const relativePath = objectName.slice(prefix.length) // chemin relatif au pack
      return {
        path:  relativePath,
        inUse: usedPaths.has(relativePath),
      }
    })

    res.json({ files })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/texture-packs/:id/files ───────────────────────────────────────
// Upload un PNG dans le pack (sans créer de voxel_texture).
// Le PNG devient disponible dans la bibliothèque du constructeur de voxel.
// Ownership : créateur du pack uniquement.
// MinIO AVANT base (P25) — ici pas de base, uniquement MinIO.
router.post('/:id/files', requireAuth, multerUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'Fichier PNG requis')

    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')
    if (pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    // Validation dimensions — multiples de tile_size
    const { width, height } = imageSize(req.file.buffer)
    if (width % pack.tile_size !== 0 || height % pack.tile_size !== 0) {
      throw new AppError(400,
        `Dimensions ${width}×${height} non multiples de tile_size (${pack.tile_size}px)`
      )
    }

    // Chemin MinIO : textures/<pack_id>/<uuid>.png
    const uuid = crypto.randomUUID()
    const relativePath = `${uuid}.png`
    const objectName = `textures/${req.params.id}/${relativePath}`

    const minio = getMinioClient()
    await minio.putObject(BUCKET(), objectName, req.file.buffer, req.file.size, {
      'Content-Type': req.file.mimetype,
    })

    res.status(201).json({ file: { path: relativePath, inUse: false } })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/texture-packs/:id/files/*filePath ───────────────────────────
// Supprime un PNG du pack dans MinIO.
// 409 si le PNG est utilisé dans les faces d'au moins une voxel_texture du pack.
// Ownership : créateur du pack uniquement.
router.delete('/:id/files/*filePath', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) throw new AppError(404, 'Pack introuvable')
    if (pack.created_by !== req.user.id) throw new AppError(403, 'Accès réservé au créateur du pack')

    const raw = req.params.filePath
    const relativePath = Array.isArray(raw) ? raw.join('/') : String(raw).replace(/,/g, '/')

    // Guard path traversal
    assertSafePath(relativePath)

    // Guard 409 — vérifier si ce PNG est utilisé dans les faces d'une voxel_texture
    const voxelTextures = await db('voxel_textures').where({ pack_id: req.params.id })
    const isUsed = voxelTextures.some(vt => {
      const faces = vt.faces || {}
      return Object.values(faces).includes(relativePath)
    })

    if (isUsed) {
      return res.status(409).json({
        error: 'Ce fichier est utilisé par un voxel — supprimez ou modifiez le voxel d\'abord',
      })
    }

    // Supprimer dans MinIO
    const objectName = `textures/${req.params.id}/${relativePath}`
    const minio = getMinioClient()
    await minio.removeObject(BUCKET(), objectName)

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
