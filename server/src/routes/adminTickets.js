import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { listTickets, updateTicket, getTicketCounts } from '../services/ticketService.js'

const router = Router()

// Route statique déclarée avant '/:id' (PC41/core.md) — pas de risque de collision ici (GET vs
// PATCH) mais convention conservée.
router.get('/stats', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const counts = await getTicketCounts()
    res.json(counts)
  } catch (err) { next(err) }
})

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { origin, status, domain, clusterLabel, activeOnly } = req.query
    const tickets = await listTickets({ origin, status, domain, clusterLabel, activeOnly: activeOnly === 'true' })
    res.json({ tickets })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { title, status, priority, cluster_label, linked_bug_code, admin_notes } = req.body
    const ticket = await updateTicket(req.user.id, req.params.id, {
      title, status, priority, cluster_label, linked_bug_code, admin_notes,
    })
    res.json({ ticket })
  } catch (err) { next(err) }
})

export default router
