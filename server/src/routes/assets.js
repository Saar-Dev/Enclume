import { Router } from 'express'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// Correspondance extension → Content-Type
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
router.get('/:folder/*filePath', async (req, res, next) => {
  try {
    const client = getMinioClient()
    const bucket = BUCKET()

    const { folder } = req.params
    const raw = req.params.filePath
    const filePath = `${folder}/${Array.isArray(raw) ? raw.join('/') : String(raw).replace(/,/g, '/')}`

    const stat = await client.statObject(bucket, filePath)

    res.setHeader('Content-Type', getContentType(filePath))
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