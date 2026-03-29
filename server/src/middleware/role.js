import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

export const requireRole = (role) => async (req, res, next) => {
  const campaignId = req.params.campaignId || req.params.id

  if (!campaignId) {
    throw new AppError(400, 'Campaign ID is required')
  }

  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: req.user.id })
    .first()

  if (!member) {
    throw new AppError(403, 'You are not a member of this campaign')
  }

  if (member.role !== role) {
    throw new AppError(403, `Role '${role}' required for this action`)
  }

  req.member = member
  next()
}