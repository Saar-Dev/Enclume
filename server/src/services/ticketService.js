import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

// Valeurs miroir des contraintes CHECK de la migration 241_bug_tickets.js (défense en profondeur
// applicative, même patron que adminUserService.changeUserRole pour `role`).
export const CATEGORIES = ['bug', 'balance', 'suggestion', 'other']
export const STATUSES = ['new', 'triaged', 'in_progress', 'suspended', 'resolved', 'wont_fix', 'duplicate']
export const PRIORITIES = ['low', 'medium', 'high', 'critical']

// Origine calculée serveur, jamais fournie par le client (PLAN_TICKETS.md §3.2) : un joueur ne peut
// pas se déclarer lui-même "admin". Ordre de priorité : admin > gm (dans au moins une campagne) >
// player. 'log' n'est jamais atteint par ce chemin — réservé à un futur appelant non humain.
async function resolveOrigin(userId) {
  const user = await db('users').where({ id: userId }).first('role')
  if (user?.role === 'admin') return 'admin'

  const gmMembership = await db('campaign_members')
    .where({ user_id: userId, role: 'gm' })
    .first('id')
  if (gmMembership) return 'gm'

  return 'player'
}

export async function createTicket(reporterId, { category, domain, title, description, context }) {
  if (!CATEGORIES.includes(category)) {
    throw new AppError(400, `category doit être l'une de : ${CATEGORIES.join(', ')}`)
  }
  if (!title?.trim() || !description?.trim()) {
    throw new AppError(400, 'title et description sont requis')
  }

  const origin = await resolveOrigin(reporterId)

  const [ticket] = await db('bug_tickets')
    .insert({
      reporter_id: reporterId,
      origin,
      category,
      domain: domain || null,
      title: title.trim(),
      description: description.trim(),
      context: context ? JSON.stringify(context) : null,
    })
    .returning('*')

  return ticket
}

export async function listTicketsForReporter(reporterId) {
  return db('bug_tickets')
    .where({ reporter_id: reporterId })
    .orderBy('created_at', 'desc')
}

export async function listTickets({ origin, status, domain, clusterLabel } = {}) {
  const query = db('bug_tickets')
    .leftJoin('users', 'bug_tickets.reporter_id', 'users.id')
    .select('bug_tickets.*', 'users.username as reporter_username')
    .orderBy('bug_tickets.created_at', 'desc')
  if (origin) query.andWhere({ origin })
  if (status) query.andWhere('bug_tickets.status', status)
  if (domain) query.andWhere({ domain })
  if (clusterLabel) query.andWhereILike('cluster_label', `%${clusterLabel}%`)
  return query
}

export async function updateTicket(actorId, id, patch) {
  const ticket = await db('bug_tickets').where({ id }).first()
  if (!ticket) {
    throw new AppError(404, 'Ticket introuvable')
  }

  const update = {}

  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) {
      throw new AppError(400, `status doit être l'un de : ${STATUSES.join(', ')}`)
    }
    update.status = patch.status
  }

  if (patch.priority !== undefined) {
    if (patch.priority !== null && !PRIORITIES.includes(patch.priority)) {
      throw new AppError(400, `priority doit être l'une de : ${PRIORITIES.join(', ')} (ou null)`)
    }
    update.priority = patch.priority
  }

  if (patch.cluster_label !== undefined) update.cluster_label = patch.cluster_label || null
  if (patch.linked_bug_code !== undefined) update.linked_bug_code = patch.linked_bug_code || null
  if (patch.admin_notes !== undefined) update.admin_notes = patch.admin_notes || null

  if (Object.keys(update).length === 0) {
    throw new AppError(400, 'Aucun champ à modifier')
  }

  update.reviewed_by = actorId
  update.reviewed_at = db.fn.now()
  update.updated_at = db.fn.now()

  const [updated] = await db('bug_tickets')
    .where({ id })
    .update(update)
    .returning('*')

  return updated
}
