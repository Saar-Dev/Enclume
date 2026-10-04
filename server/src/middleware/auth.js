import jwt from 'jsonwebtoken'
import { AppError } from '../lib/AppError.js'

// Variante non-levante — cookie absent ou invalide → null, jamais une exception. Réutilisée par
// requireAuth ci-dessous (garde stricte, lève si null) et par toute route qui accepte PLUSIEURS
// preuves d'autorisation possibles (ex. assets.js : cookie OU jeton signé par asset, ASSETS-
// ROUTE-NO-AUTH) sans dupliquer la lecture cookie + vérification JWT à chaque fois.
export const getAuthenticatedUser = (req) => {
  const token = req.cookies?.token
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

export const requireAuth = (req, res, next) => {
  const user = getAuthenticatedUser(req)
  if (!user) {
    throw new AppError(401, 'Authentication required')
  }
  req.user = user
  next()
}