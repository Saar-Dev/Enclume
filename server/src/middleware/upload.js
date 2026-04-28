import multer from 'multer'
import crypto from 'crypto'
import path from 'path'
import getMinioClient, { BUCKET, getFileUrl } from '../lib/minio.js'
import { AppError } from '../lib/AppError.js'

// Types MIME autorisés — images et documents
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]

// Types MIME autorisés — modèles 3D GLB
// application/octet-stream : certains clients envoient ce type générique pour les .glb
const ALLOWED_GLB_MIME_TYPES = [
  'model/gltf-binary',
  'application/octet-stream',
]

// Taille max : 20 Mo
const MAX_SIZE = 20 * 1024 * 1024

// Multer stocke le fichier en mémoire (buffer) — on l'envoie ensuite à MinIO
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError(400, `Type de fichier non autorisé : ${file.mimetype}`), false)
  }
}

const glbFileFilter = (req, file, cb) => {
  if (ALLOWED_GLB_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError(400, `Type de fichier non autorisé : ${file.mimetype}`), false)
  }
}

export const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
})

// Multer dédié aux modèles 3D GLB
export const multerGlb = multer({
  storage,
  fileFilter: glbFileFilter,
  limits: { fileSize: MAX_SIZE },
})

// Génère un nom de fichier unique pour éviter les collisions
const generateObjectName = (folder, originalName) => {
  const ext = path.extname(originalName).toLowerCase()
  const unique = crypto.randomUUID()
  return `${folder}/${unique}${ext}`
}

// Middleware principal : upload vers MinIO après que multer a reçu le fichier
// Usage dans une route : multerUpload.single('image'), uploadToMinio('battlemaps')
export const uploadToMinio = (folder) => async (req, res, next) => {
  try {
    if (!req.file) return next()

    const objectName = generateObjectName(folder, req.file.originalname)
    const minio = getMinioClient()

    await minio.putObject(
      BUCKET(),
      objectName,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    )

    // On ajoute l'URL au fichier pour que la route puisse l'utiliser
    req.file.url = getFileUrl(objectName)
    req.file.objectName = objectName

    next()
  } catch (err) {
    next(new AppError(500, `Erreur upload MinIO : ${err.message}`))
  }
}
