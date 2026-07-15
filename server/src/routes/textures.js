import { Router } from 'express'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// Proxyfie un fichier texture (PNG, manifest, ZIP)
// :pack = UUID du pack (ex: b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e)
// *filePath = chemin relatif au pack (ex: sol/metal_plate_top.png)
//
// Note : GET / supprimé — scannait MinIO + JSON.parse sur tous les fichiers (P28)
// Liste des packs disponible via GET /api/texture-packs (source de vérité en base)
router.get('/:pack/*filePath', async (req, res, next) => {
  try {
    const client = getMinioClient()
    const bucket = BUCKET()
    const raw = req.params.filePath
    const filePath = `textures/${req.params.pack}/${Array.isArray(raw) ? raw.join('/') : String(raw).replace(/,/g, '/')}`
    const stat = await client.statObject(bucket, filePath)
    const contentType = filePath.endsWith('.png') ? 'image/png'
      : filePath.endsWith('.zip') ? 'application/zip'
      : 'application/json'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    const stream = await client.getObject(bucket, filePath)
    stream.pipe(res)
  } catch (err) {
    if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
      res.status(404).json({ error: { status: 404, message: 'Texture introuvable' } })
    } else {
      next(err)
    }
  }
})

export default router
