import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

// Chaîné après requireAuth. Relit le rôle en base à chaque requête, jamais depuis le JWT (qui ne
// porte pas role et n'est régénéré que si username/email change, routes/users.js) — sinon une
// rétrogradation resterait sans effet jusqu'à expiration du cookie (7 jours). Fail-closed : égalité
// stricte à 'admin', un compte introuvable ou tout rôle inattendu est refusé.
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      // Toujours chaîné après requireAuth — s'il manque, c'est un mésusage à la déclaration de
      // route, pas un visiteur non authentifié. Échoue clairement (401) plutôt qu'un TypeError confus.
      throw new AppError(401, 'Authentication required')
    }
    const user = await db('users').where({ id: req.user.id }).first('role')
    if (!user || user.role !== 'admin') {
      throw new AppError(403, 'Admin access required')
    }
    next()
  } catch (err) {
    next(err)
  }
}
