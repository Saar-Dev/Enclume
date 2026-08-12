import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { listUsers, changeUserRole } from '../services/adminUserService.js'

const router = Router()

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await listUsers()
    res.json({ users })
  } catch (err) { next(err) }
})

router.patch('/:id/role', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const updated = await changeUserRole(req.user.id, req.params.id, req.body.role)
    res.json({ user: updated })
  } catch (err) { next(err) }
})

export default router
