import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { createTicket, listTicketsForReporter } from '../services/ticketService.js'

const router = Router()

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { category, domain, title, description, context } = req.body
    const ticket = await createTicket(req.user.id, { category, domain, title, description, context })
    res.status(201).json({ ticket })
  } catch (err) { next(err) }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const tickets = await listTicketsForReporter(req.user.id)
    res.json({ tickets })
  } catch (err) { next(err) }
})

export default router
