import { Router } from 'express'
import { randomUUID } from 'crypto'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'

const router = Router()

// ─── Constantes dés ────────────────────────────────────────────────────────────
const VALID_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DICE_FACES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }

/**
 * Valide la structure dice_config avant toute écriture en base.
 *
 * Structure attendue :
 * {
 *   "d20": { "success": { "min": 18, "max": 20 }, "fail": { "min": 1, "max": 1 } },
 *   "d6":  { "success": { "min": 6,  "max": 6  }, "fail": null },
 *   "d100":{ "success": null, "fail": { "min": 1, "max": 5 } }
 * }
 *
 * Règles :
 * - null accepté (désactive tous les critiques)
 * - objet : seules les clés VALID_DICE sont acceptées
 * - success et fail : null ou { min, max } avec 1 <= min <= max <= faces du dé
 *
 * @param {any} config
 * @throws {AppError} si la structure est invalide
 */
function validateDiceConfig(config) {
  if (config === null || config === undefined) return

  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new AppError(400, 'dice_config must be an object or null')
  }

  for (const [die, value] of Object.entries(config)) {
    if (!VALID_DICE.includes(die)) {
      throw new AppError(400, `dice_config: unknown die type "${die}". Valid types: ${VALID_DICE.join(', ')}`)
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError(400, `dice_config.${die} must be an object`)
    }

    const faces = DICE_FACES[die]

    for (const critType of ['success', 'fail']) {
      const crit = value[critType]
      if (crit === null || crit === undefined) continue

      if (typeof crit !== 'object' || Array.isArray(crit)) {
        throw new AppError(400, `dice_config.${die}.${critType} must be an object or null`)
      }

      const { min, max } = crit

      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new AppError(400, `dice_config.${die}.${critType}: min and max must be integers`)
      }

      if (min < 1) {
        throw new AppError(400, `dice_config.${die}.${critType}.min must be >= 1`)
      }

      if (max > faces) {
        throw new AppError(400, `dice_config.${die}.${critType}.max must be <= ${faces} (faces of ${die})`)
      }

      if (min > max) {
        throw new AppError(400, `dice_config.${die}.${critType}: min (${min}) must be <= max (${max})`)
      }
    }
  }
}

// GET /api/campaigns — liste des campagnes de l'utilisateur
router.get('/', requireAuth, async (req, res) => {
  const campaigns = await db('campaigns')
    .join('campaign_members', 'campaigns.id', 'campaign_members.campaign_id')
    .where('campaign_members.user_id', req.user.id)
    .select(
      'campaigns.id',
      'campaigns.name',
      'campaigns.status',
      'campaigns.invite_code',
      'campaigns.created_at',
      'campaign_members.role'
    )
  res.json({ campaigns })
})

// POST /api/campaigns — créer une campagne
router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body
  if (!name) throw new AppError(400, 'Campaign name is required')

  const invite_code = randomUUID().split('-')[0]

  // Transaction : campagne + battlemap vide + default_battlemap_id en une seule opération
  const campaign = await db.transaction(async (trx) => {
    // 1. Créer la campagne
    const [newCampaign] = await trx('campaigns')
      .insert({ name, gm_id: req.user.id, invite_code })
      .returning(['id', 'name', 'status', 'invite_code', 'created_at'])

    // 2. Créer le membre GM
    await trx('campaign_members').insert({
      campaign_id: newCampaign.id,
      user_id: req.user.id,
      role: 'gm',
    })

    // 3. Créer la battlemap d'accueil par défaut
    const [defaultMap] = await trx('battlemaps')
      .insert({
        campaign_id: newCampaign.id,
        name: "Carte d'accueil",
      })
      .returning(['id'])

    // 4. Définir cette battlemap comme carte d'accueil de la campagne
    await trx('campaigns')
      .where({ id: newCampaign.id })
      .update({ default_battlemap_id: defaultMap.id })

    return { ...newCampaign, default_battlemap_id: defaultMap.id }
  })

  res.status(201).json({ campaign })
})

// GET /api/campaigns/:id — détail d'une campagne
// Accessible à tous les membres (GM et joueurs)
router.get('/:id', requireAuth, async (req, res) => {
  const member = await db('campaign_members')
    .where({ campaign_id: req.params.id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'You are not a member of this campaign')

  const campaign = await db('campaigns')
    .where({ 'campaigns.id': req.params.id })
    .first()
  if (!campaign) throw new AppError(404, 'Campaign not found')

  const members = await db('campaign_members')
    .join('users', 'campaign_members.user_id', 'users.id')
    .where('campaign_members.campaign_id', req.params.id)
    .select(
      'users.id',
      'users.username',
      'campaign_members.role',
      'campaign_members.character_name'
    )

  const battlemaps = await db('battlemaps')
    .where({ campaign_id: req.params.id })
    .select('id', 'name', 'folder', 'created_at')

  res.json({ campaign, members, battlemaps })
})

// PUT /api/campaigns/:id — modifier une campagne
router.put('/:id', requireAuth, requireRole('gm'), async (req, res) => {
  const { name, status, default_battlemap_id, dice_config } = req.body
  const updates = {}
  if (name !== undefined) updates.name = name
  if (status !== undefined) updates.status = status
  if (default_battlemap_id !== undefined) updates.default_battlemap_id = default_battlemap_id

  // dice_config — validation avant écriture
  if (dice_config !== undefined) {
    validateDiceConfig(dice_config)
    updates.dice_config = dice_config === null ? null : JSON.stringify(dice_config)
  }

  // updated_at systématique sur tout PUT
  updates.updated_at = db.fn.now()

  const [campaign] = await db('campaigns')
    .where({ id: req.params.id })
    .update(updates)
    .returning(['id', 'name', 'status', 'invite_code', 'default_battlemap_id', 'dice_config', 'created_at', 'updated_at'])
  res.json({ campaign })
})

// POST /api/campaigns/join — rejoindre via invite_code
router.post('/join', requireAuth, async (req, res) => {
  const { invite_code } = req.body
  if (!invite_code) throw new AppError(400, 'Invite code is required')

  const campaign = await db('campaigns').where({ invite_code }).first()
  if (!campaign) throw new AppError(404, 'Campaign not found')

  const existing = await db('campaign_members')
    .where({ campaign_id: campaign.id, user_id: req.user.id })
    .first()
  if (existing) throw new AppError(409, 'You are already a member of this campaign')

  await db('campaign_members').insert({
    campaign_id: campaign.id,
    user_id: req.user.id,
    role: 'player',
  })

  res.status(201).json({ campaign: { id: campaign.id, name: campaign.name } })
})

// GET /api/campaigns/:id/members — liste des membres
router.get('/:id/members', requireAuth, requireRole('gm'), async (req, res) => {
  const members = await db('campaign_members')
    .join('users', 'campaign_members.user_id', 'users.id')
    .where('campaign_members.campaign_id', req.params.id)
    .select(
      'users.id',
      'users.username',
      'campaign_members.role',
      'campaign_members.character_name'
    )
  res.json({ members })
})

export default router 