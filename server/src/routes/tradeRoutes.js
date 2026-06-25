// tradeRoutes.js — Routes REST Trade
// Monté dans server/src/index.js :
//   merchantsRouter  → /api/campaigns/:campaignId/merchants
//   tradeLogRouter   → /api/campaigns/:campaignId/trade-log

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getMerchants,
  upsertMerchant,
  deleteMerchant,
  getCatalog,
  buyFromMerchant,
  getTradeLog,
} from '../services/tradeService.js'

// ─── Helper : vérifier appartenance campagne ─────────────────────────────────

async function getMember(campaignId, userId) {
  const member = await db('campaign_members')
    .where({ campaign_id: campaignId, user_id: userId })
    .first()
  if (!member) throw new AppError(403, 'Accès refusé')
  return member
}

// ─── Router marchands ────────────────────────────────────────────────────────

export const merchantsRouter = Router({ mergeParams: true })

// GET / — liste des marchands
merchantsRouter.get('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params
  const member = await getMember(campaignId, req.user.id)
  const isGm = member.role === 'gm'
  const merchants = await getMerchants(campaignId, { isGm, userId: req.user.id })
  res.json(merchants)
})

// POST / — créer un marchand (GM only)
merchantsRouter.post('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params
  const member = await getMember(campaignId, req.user.id)
  if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')
  const merchant = await upsertMerchant(campaignId, req.body)
  res.status(201).json(merchant)
})

// PUT /:mid — modifier un marchand (GM only)
merchantsRouter.put('/:mid', requireAuth, async (req, res) => {
  const { campaignId, mid } = req.params
  const member = await getMember(campaignId, req.user.id)
  if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')
  const merchant = await upsertMerchant(campaignId, { ...req.body, id: mid })
  res.json(merchant)
})

// DELETE /:mid — supprimer un marchand (GM only)
merchantsRouter.delete('/:mid', requireAuth, async (req, res) => {
  const { campaignId, mid } = req.params
  const member = await getMember(campaignId, req.user.id)
  if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')
  await deleteMerchant(campaignId, mid)
  res.status(204).end()
})

// GET /:mid/catalog — catalogue filtré (stub étape 5)
merchantsRouter.get('/:mid/catalog', requireAuth, async (req, res) => {
  const { campaignId, mid } = req.params
  const member = await getMember(campaignId, req.user.id)
  const { charId } = req.query
  const catalog = await getCatalog(campaignId, mid, {
    isGm: member.role === 'gm',
    charId,
  })
  res.json(catalog)
})

// POST /:mid/buy — achat marchand (stub étape 6)
merchantsRouter.post('/:mid/buy', requireAuth, async (req, res) => {
  const { campaignId, mid } = req.params
  await getMember(campaignId, req.user.id)
  const result = await buyFromMerchant(campaignId, {
    merchantId: mid,
    ...req.body,
  })
  res.json(result)
})

// ─── Router livre de compte ──────────────────────────────────────────────────

export const tradeLogRouter = Router({ mergeParams: true })

// GET / — livre de compte (GM only)
tradeLogRouter.get('/', requireAuth, async (req, res) => {
  const { campaignId } = req.params
  const member = await getMember(campaignId, req.user.id)
  if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')
  const { page, type } = req.query
  const result = await getTradeLog(campaignId, {
    page: page ? Number(page) : 1,
    type,
  })
  res.json(result)
})
