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
import charactersRouter, { actionsRouter as charactersActionsRouter } from './routes/characters.js'
import assetsRouter from './routes/assets.js'
import usersRouter from './routes/users.js'


const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  }
})

// Rendre io accessible depuis les routes Express via req.app.get('io')
// Doit être placé après la création de io et avant le montage des routes.
app.set('io', io)

// Middlewares de base
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/api/textures', texturesRouter)
app.use('/api/assets', assetsRouter)

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'Enclume' })
})
app.use('/api/auth', authRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/campaigns/:campaignId/characters', charactersRouter)
app.use('/api/characters', charactersActionsRouter)
app.use('/api/campaigns/:id/battlemaps', battlemapsRouter)
app.use('/api/battlemaps', battlemapsRouter)
app.use('/api/battlemaps/:id/tokens', tokensRouter)
app.use('/api/tokens', tokensRouter)
app.use('/api/users', usersRouter)

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
    console.error('Erreur au démarrage :', err)
    process.exit(1)
  }
}

startServer()
