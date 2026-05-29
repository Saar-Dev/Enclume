import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
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

// Palette de 12 couleurs distinctes et lisibles sur fond sombre.
// Suffisamment espacées pour qu'aucune session ne confonde deux joueurs.
const PLAYER_COLORS = [
  '#E05252', // rouge
  '#E0A052', // orange
  '#D4E052', // jaune-vert
  '#52E07A', // vert
  '#52D4E0', // cyan
  '#527AE0', // bleu
  '#8A52E0', // violet
  '#E052C8', // rose
  '#E05290', // framboise
  '#52E0C8', // turquoise
  '#A0E052', // chartreuse
  '#E07A52', // corail
]

const randomColor = () => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, username, inviteCode } = req.body

  if (!email || !password || !username || !inviteCode) {
    throw new AppError(400, 'Email, password, username and invite code are required')
  }

  const envCode = process.env.REGISTRATION_CODE
  if (!envCode || !/^\d{8}$/.test(envCode)) {
    throw new AppError(500, 'Server misconfiguration: REGISTRATION_CODE not set')
  }

  const submitted = Buffer.from(String(inviteCode).slice(0, 8).padEnd(8, '\0'))
  const expected  = Buffer.from(envCode)
  if (!crypto.timingSafeEqual(submitted, expected)) {
    throw new AppError(403, 'Invalid invite code')
  }

  if (password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters')
  }

  const existing = await db('users').where({ email }).first()
  if (existing) {
    throw new AppError(409, 'Email already in use')
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  const color = randomColor()

  const [user] = await db('users')
    .insert({ email, password_hash, username, color })
    .returning(['id', 'email', 'username', 'color'])

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
  res.json({ user: { id: user.id, email: user.email, username: user.username, color: user.color } })
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
    .select(['id', 'email', 'username', 'color'])
    .first()

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  res.json({ user })
})

export default router
