import jwt from 'jsonwebtoken'
import { parse } from 'cookie'

// Middleware d'authentification WebSocket
// Fonctionne comme requireAuth mais pour Socket.io
// Appelé avant d'accepter chaque connexion WebSocket

const socketAuth = (socket, next) => {
  try {
    // Les cookies sont dans le handshake HTTP initial
    const cookieHeader = socket.handshake.headers.cookie
    if (!cookieHeader) {
      return next(new Error('Authentication required'))
    }

    const cookies = parse(cookieHeader)
    const token = cookies.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET)
    socket.user = payload // disponible dans tous les handlers via socket.user

    next()
  } catch {
    next(new Error('Invalid or expired token'))
  }
}

export default socketAuth
