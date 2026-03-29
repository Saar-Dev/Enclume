import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import db from './db/knex.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.js'
import campaignsRouter from './routes/campaigns.js'

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

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'Enclume' })
})
app.use('/api/auth', authRouter)
app.use('/api/campaigns', campaignsRouter)

// Socket.io
io.on('connection', (socket) => {
  console.log('Joueur connecté :', socket.id)
  socket.on('disconnect', () => {
    console.log('Joueur déconnecté :', socket.id)
  })
})

// Gestionnaire d'erreurs — doit être le dernier middleware
app.use(errorHandler)

// Démarrage : vérification DB puis lancement serveur
const PORT = process.env.PORT || 3001
db.raw('SELECT 1')
  .then(() => {
    console.log('Base de données connectée')
    httpServer.listen(PORT, () => {
      console.log(`Serveur Enclume démarré sur le port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Impossible de se connecter à la base de données :', err.message)
    process.exit(1)
  })