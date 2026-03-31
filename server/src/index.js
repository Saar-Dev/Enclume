import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import db from './db/knex.js'
import getMinioClient, { BUCKET } from './lib/minio.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.js'
import campaignsRouter from './routes/campaigns.js'
import battlemapsRouter from './routes/battlemaps.js'
import tokensRouter from './routes/tokens.js'
import initSocket from './socket/index.js'
import texturesRouter from './routes/textures.js'


const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  }
})

// Middlewares de base
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/api/textures', texturesRouter)

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'Enclume' })
})
app.use('/api/auth', authRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/campaigns/:id/battlemaps', battlemapsRouter)
app.use('/api/battlemaps', battlemapsRouter)
app.use('/api/battlemaps/:id/tokens', tokensRouter)
app.use('/api/tokens', tokensRouter)

// Socket.io
initSocket(io)

// Gestionnaire d'erreurs — doit être le dernier middleware
app.use(errorHandler)

// Démarrage : vérification DB + MinIO puis lancement serveur
const PORT = process.env.PORT || 3001

const startServer = async () => {
  try {
    // Vérification PostgreSQL
    await db.raw('SELECT 1')
    console.log('Base de données connectée')

    // Vérification MinIO — bucket accessible
    const minio = getMinioClient()
    await minio.bucketExists(BUCKET())
    console.log(`MinIO connecté — bucket "${BUCKET()}" accessible`)

    // Tout est prêt — on lance le serveur
    httpServer.listen(PORT, () => {
      console.log(`Serveur Enclume démarré sur le port ${PORT}`)
    })
  } catch (err) {
    console.error('Erreur au démarrage :', err.message)
    process.exit(1)
  }
}

startServer()
