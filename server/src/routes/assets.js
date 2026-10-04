import { Router } from 'express'
import getMinioClient, { BUCKET } from '../lib/minio.js'
import { getAuthenticatedUser } from '../middleware/auth.js'
import { verifyAssetToken } from '../lib/assetUrlSigning.js'
import { AppError } from '../lib/AppError.js'

const router = Router()

// ASSETS-ROUTE-NO-AUTH — le commentaire ci-dessous disait déjà « Auth requise » mais aucun
// middleware ne l'imposait (route montée sans garde dans server/src/index.js). PAS un simple
// router.use(requireAuth) : vérifié dans three.js que GLTFLoader (fetch, credentials:'same-origin')
// et TextureLoader/useTexture (Image, crossOrigin:'anonymous') n'envoient JAMAIS le cookie de
// session dès que le port diffère (dev ET Kiwi ont client/serveur sur des ports différents) — seul
// un <img src> brut s'en sortirait. D'où le jeton signé par asset (server/src/lib/assetUrlSigning.js,
// même esprit que les URLs présignées S3/GCS) : accepté ICI en plus du cookie, jamais à la place —
// un appel déjà authentifié par cookie (ex. outil admin) continue de fonctionner sans jeton.
// `builtin-models` (modèles génériques, non spécifiques à une campagne) reste monté séparément et
// public, avant ce routeur (server/src/index.js) — hors périmètre, pas concerné par cette garde.
//
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
    const { folder } = req.params
    const raw = req.params.filePath
    const filePath = `${folder}/${Array.isArray(raw) ? raw.join('/') : String(raw).replace(/,/g, '/')}`

    // Cookie de session OU jeton signé pour CE chemin exact (jamais un jeton valide pour un autre
    // asset) — voir le commentaire en tête de fichier pour le pourquoi des deux voies.
    if (!getAuthenticatedUser(req) && !verifyAssetToken(filePath, req.query.t)) {
      throw new AppError(401, 'Authentication required')
    }

    const client = getMinioClient()
    const bucket = BUCKET()

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
    // statObject (HEAD, sans corps XML) renvoie 'NotFound' ; un getObject sur corps XML
    // renverrait 'NoSuchKey' pour la même absence — le SDK minio n'unifie pas les deux
    // selon le verbe HTTP. Les deux signifient "objet absent", jamais une panne d'infra
    // (bucket manquant, credentials, connexion) qui doit continuer vers next(err) en 500.
    if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
      res.status(404).json({ error: { status: 404, message: 'Asset introuvable' } })
    } else {
      next(err)
    }
  }
})

export default router
