import jwt from 'jsonwebtoken'
import { AppError } from '../lib/AppError.js'

export const requireAuth = (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    throw new AppError(401, 'Authentication required')
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch {
    throw new AppError(401, 'Invalid or expired token')
  }
}