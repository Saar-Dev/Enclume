/**
 * creation.js — Routes wizard création de personnage (COUCHE 3).
 *
 * Monté sous /api/creation dans index.js.
 *
 * Ownership : router.use(requireAuth) + router.param('sheetId', ...) résolvent
 * char_sheet → characters → campaign_members avant chaque handler (owner OU GM).
 * req.sheet et req.character disponibles dans toutes les routes /:sheetId.
 *
 * Scope : Step 4 (background/carrière) + Step 5 (avantages/désavantages).
 * Step 1-3 backend (ledger init, creation_state initial) : hors scope (PLAN_E1+2/E3, futur).
 *
 * Routes :
 *   GET    /api/creation/:sheetId/step4/ref   — données de référence step4 (backgrounds + carrières)
 *   GET    /api/creation/:sheetId/step4       — état courant step4 (archetype + carrières)
 *   POST   /api/creation/:sheetId/step4       — valide et persiste step4
 *   DELETE /api/creation/:sheetId/step4       — annule step4 (replay snapshot, retour draft_step3)
 *   GET    /api/creation/:sheetId/step5/ref   — liste ref_advantages
 *   POST   /api/creation/:sheetId/step5       — ajoute un lot d'avantages/désavantages (transaction unique)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getStep4RefData, getStep4State, validateAndPersistStep4, rollbackStep4, getStep5RefData,
} from '../services/creationService.js'
import { addAdvantage } from '../services/advantageService.js'

const router = Router()

router.use(requireAuth)

router.param('sheetId', async (req, res, next, sheetId) => {
  try {
    const sheet = await db('char_sheet').where({ id: sheetId }).first()
    if (!sheet) return next(new AppError(404, 'Fiche introuvable'))

    const character = await db('characters').where({ id: sheet.character_id }).first()
    if (!character) return next(new AppError(404, 'Personnage introuvable'))

    const member = await db('campaign_members')
      .where({ campaign_id: character.campaign_id, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, "Vous n'êtes pas membre de cette campagne"))

    const isOwner = character.user_id && character.user_id === req.user.id
    if (!isOwner && member.role !== 'gm') {
      return next(new AppError(403, "Vous n'avez pas accès à cette fiche"))
    }

    req.sheet = sheet
    req.character = character
    req.isGm = member.role === 'gm'
    next()
  } catch (err) { next(err) }
})

// ─── Step 4 ────────────────────────────────────────────────────────────────────

router.get('/:sheetId/step4/ref', async (req, res, next) => {
  try {
    const ref = await getStep4RefData(req.sheet.id)
    res.json(ref)
  } catch (err) { next(err) }
})

router.get('/:sheetId/step4', async (req, res, next) => {
  try {
    const state = await getStep4State(req.sheet.id)
    res.json(state)
  } catch (err) { next(err) }
})

router.post('/:sheetId/step4', async (req, res, next) => {
  try {
    const result = await validateAndPersistStep4(req.sheet.id, req.body)
    res.json(result)
  } catch (err) { next(err) }
})

router.delete('/:sheetId/step4', async (req, res, next) => {
  try {
    const result = await rollbackStep4(req.sheet.id)
    res.json(result)
  } catch (err) { next(err) }
})

// ─── Step 5 ────────────────────────────────────────────────────────────────────

router.get('/:sheetId/step5/ref', async (req, res, next) => {
  try {
    const advantages = await getStep5RefData()
    res.json(advantages)
  } catch (err) { next(err) }
})

router.post('/:sheetId/step5', async (req, res, next) => {
  try {
    if (req.sheet.creation_state !== 'draft_step4') {
      throw new AppError(400, `État de création invalide pour step5 : ${req.sheet.creation_state}`)
    }

    const { advantages } = req.body
    if (!Array.isArray(advantages) || advantages.length === 0) {
      throw new AppError(400, "Liste d'avantages requise")
    }

    await db.transaction(async (trx) => {
      for (const advantageId of advantages) {
        await addAdvantage(req.sheet.id, advantageId, 'creation_step5', trx)
      }
      await trx('char_sheet').where({ id: req.sheet.id }).update({ creation_state: 'draft_step5' })
    })

    res.json({ creation_state: 'draft_step5' })
  } catch (err) { next(err) }
})

export default router
