import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { listTickets, updateTicket } from '../services/ticketService.js'

const router = Router()

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { origin, status, domain, clusterLabel } = req.query
    const tickets = await listTickets({ origin, status, domain, clusterLabel })
    res.json({ tickets })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, priority, cluster_label, linked_bug_code, admin_notes } = req.body
    const ticket = await updateTicket(req.user.id, req.params.id, {
      status, priority, cluster_label, linked_bug_code, admin_notes,
    })
    res.json({ ticket })
  } catch (err) { next(err) }
})

export default router
