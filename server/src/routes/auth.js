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
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, username } = req.body

  if (!email || !password || !username) {
    throw new AppError(400, 'Email, password and username are required')
  }

  if (password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters')
  }

  const existing = await db('users').where({ email }).first()
  if (existing) {
    throw new AppError(409, 'Email already in use')
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  const [user] = await db('users')
    .insert({ email, password_hash, username })
    .returning(['id', 'email', 'username'])

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.cookie('token', token, COOKIE_OPTIONS)
  res.status(201).json({ user })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required')
  }

  const user = await db('users').where({ email }).first()
  if (!user) {
    throw new AppError(401, 'Invalid credentials')
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    throw new AppError(401, 'Invalid credentials')
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.cookie('token', token, COOKIE_OPTIONS)
  res.json({ user: { id: user.id, email: user.email, username: user.username } })
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await db('users')
    .where({ id: req.user.id })
    .select(['id', 'email', 'username'])
    .first()

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  res.json({ user })
})

export default router