/**
 * creation.js — Routes wizard création de personnage.
 *
 * Architecture client-primary (Session 130) :
 * Toutes les données restent dans Zustand jusqu'au bouton "Finaliser".
 * Un seul POST /:sheetId/finalize envoie le payload complet des 5 étapes.
 *
 * Routes :
 *   POST   /api/creation/start                  — démarre un brouillon (character + char_sheet)
 *   GET    /api/creation/:sheetId/step4/ref     — données de référence step4 (backgrounds + carrières)
 *   GET    /api/creation/:sheetId/step4         — état courant step4 (archetype + carrières)
 *   GET    /api/creation/:sheetId/step5/ref     — liste ref_advantages
 *   POST   /api/creation/:sheetId/finalize      — finalise le personnage (payload complet)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getStep4RefData, getStep4State, getStep5RefData,
  startCreation, finalizeCreation,
} from '../services/creationService.js'

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

// ─── Start ─────────────────────────────────────────────────────────────────────

router.post('/start', async (req, res, next) => {
  try {
    const { campaignId } = req.body
    if (!campaignId) return next(new AppError(400, 'campaignId requis'))

    const member = await db('campaign_members')
      .where({ campaign_id: campaignId, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, "Vous n'êtes pas membre de cette campagne"))

    const result = await startCreation(campaignId, req.user.id)
    res.json(result)
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

// ─── Step 5 ────────────────────────────────────────────────────────────────────

router.get('/:sheetId/step5/ref', async (req, res, next) => {
  try {
    const advantages = await getStep5RefData()
    res.json(advantages)
  } catch (err) { next(err) }
})

// ─── Finalize ──────────────────────────────────────────────────────────────────

router.post('/:sheetId/finalize', async (req, res, next) => {
  try {
    const { step1, step2, step3, step4, step5 } = req.body
    if (!step1 || !step2 || !step3 || !step4 || !step5) {
      return next(new AppError(400, 'Payload finalize incomplet'))
    }
    const result = await finalizeCreation(req.sheet.id, { step1, step2, step3, step4, step5 })
    res.json(result)
  } catch (err) { next(err) }
})

export default router
