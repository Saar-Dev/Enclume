import { Router } from 'express'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// Correspondance extension → Content-Type (fallback si pas de metadata)
const CONTENT_TYPES = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.glb':  'model/gltf-binary',
  '.json': 'application/json',
  '.pdf':  'application/pdf',
}

const getContentType = (filePath) => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return CONTENT_TYPES[ext] || 'application/octet-stream'
}

// GET /api/assets/:folder/*filePath
// Proxyfie n'importe quel fichier d'un sous-dossier MinIO vers le client.
// Auth requise — les assets ne sont pas publics.
// Exemple : GET /api/assets/tokens/default.glb
//           GET /api/assets/campaigns/cover.png
//           GET /api/assets/characters/<id>/illustration  (sans extension — Content-Type via metadata)
router.get('/:folder/*filePath', async (req, res, next) => {
  try {
    const client = getMinioClient()
    const bucket = BUCKET()

    const { folder } = req.params
    const raw = req.params.filePath
    const filePath = `${folder}/${Array.isArray(raw) ? raw.join('/') : String(raw).replace(/,/g, '/')}`

    const stat = await client.statObject(bucket, filePath)

    // Priorité au Content-Type stocké dans les metadata MinIO lors de l'upload.
    // Fallback sur la détection par extension (assets existants avec extension).
    const contentType = stat.metaData?.['content-type']
      || stat.metaData?.['Content-Type']
      || getContentType(filePath)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const stream = await client.getObject(bucket, filePath)
    stream.pipe(res)
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      res.status(404).json({ error: { status: 404, message: 'Asset introuvable' } })
    } else {
      next(err)
    }
  }
})

export default router
