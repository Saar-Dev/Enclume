import * as Minio from 'minio'

export const BUCKET = () => process.env.MINIO_BUCKET || 'enclume-assets'

export const getFileUrl = (objectName) => {
  return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET()}/${objectName}`
}

// Initialisation lazy — appelée après dotenv.config()
let _client = null

const getMinioClient = () => {
  if (!_client) {
    _client = new Minio.Client({
      endPoint:  process.env.MINIO_ENDPOINT,
      port:      parseInt(process.env.MINIO_PORT),
      useSSL:    false,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    })
  }
  return _client
}

export default getMinioClient
