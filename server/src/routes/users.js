import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const SALT_ROUNDS = 12
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

// PUT /api/users/me
// Modifie le profil de l'utilisateur connecté.
// Champs optionnels : username, email, color, password (+ current_password requis)
router.put('/me', requireAuth, async (req, res) => {
  const { username, email, color, password, current_password } = req.body

  // Au moins un champ à modifier
  if (!username && !email && !color && !password) {
    throw new AppError(400, 'Au moins un champ à modifier est requis')
  }

  // Validation couleur hex si fournie
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new AppError(400, 'Couleur invalide — format attendu : #RRGGBB')
  }

  // Récupérer l'utilisateur actuel en base
  const currentUser = await db('users').where({ id: req.user.id }).first()
  if (!currentUser) {
    throw new AppError(404, 'Utilisateur introuvable')
  }

  // Vérification email unique si changement
  if (email && email !== currentUser.email) {
    const existing = await db('users').where({ email }).first()
    if (existing) {
      throw new AppError(409, 'Cet email est déjà utilisé')
    }
  }

  // Changement de mot de passe : current_password obligatoire
  let password_hash
  if (password) {
    if (!current_password) {
      throw new AppError(400, 'Le mot de passe actuel est requis pour changer de mot de passe')
    }
    if (password.length < 8) {
      throw new AppError(400, 'Le nouveau mot de passe doit contenir au moins 8 caractères')
    }
    const valid = await bcrypt.compare(current_password, currentUser.password_hash)
    if (!valid) {
      throw new AppError(401, 'Mot de passe actuel incorrect')
    }
    password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  }

  // Construire l'objet de mise à jour — seulement les champs fournis
  const updates = {}
  if (username) updates.username = username
  if (email) updates.email = email
  if (color) updates.color = color
  if (password_hash) updates.password_hash = password_hash

  // updated_at systématique sur tout PUT
  updates.updated_at = db.fn.now()

  const [updated] = await db('users')
    .where({ id: req.user.id })
    .update(updates)
    .returning(['id', 'email', 'username', 'color', 'updated_at'])

  // Régénérer le cookie JWT si username ou email a changé
  // — le socket.user vient du JWT, sans ça le nouveau username n'apparaît pas dans le chat
  if (updates.username || updates.email) {
    const token = jwt.sign(
      { id: updated.id, email: updated.email, username: updated.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.cookie('token', token, COOKIE_OPTIONS)
  }

  res.json({ user: updated })
})

export default router
