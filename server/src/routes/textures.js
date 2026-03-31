import { Router } from 'express'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const router = Router()

// Liste tous les packs disponibles avec leur manifest
router.get('/', async (req, res, next) => {
  try {
    const client = getMinioClient()
    const bucket = BUCKET()

    // Liste les objets dans textures/ sur MinIO
    const objects = []
    const stream = client.listObjectsV2(bucket, 'textures/', true)

    stream.on('data', obj => objects.push(obj.name))
    stream.on('error', err => next(err))
    stream.on('end', async () => {
      // On garde uniquement les manifest.json
      const manifests = objects.filter(name => name.endsWith('manifest.json'))

      const packs = await Promise.all(manifests.map(async (path) => {
        const chunks = []
        const stream = await client.getObject(bucket, path)
        for await (const chunk of stream) chunks.push(chunk)
        const manifest = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        return manifest
      }))

      res.json({ packs })
    })
  } catch (err) {
    next(err)
  }
})

// Proxyfie un fichier texture (PNG ou manifest)
router.get('/:pack/*filePath', async (req, res, next) => {
  try {
    const client = getMinioClient()
    const bucket = BUCKET()
    const raw = req.params.filePath
    const filePath = `textures/${req.params.pack}/${Array.isArray(raw) ? raw.join('/') : String(raw).replace(/,/g, '/')}`
    const stat = await client.statObject(bucket, filePath)
    const contentType = filePath.endsWith('.png') ? 'image/png' : 'application/json'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    const stream = await client.getObject(bucket, filePath)
    stream.pipe(res)
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      res.status(404).json({ error: { status: 404, message: 'Texture introuvable' } })
    } else {
      next(err)
    }
  }
})

export default router