/**
 * creation.js — Routes wizard création de personnage.
 *
 * Architecture client-primary (Session 130) : toutes les données restent dans
 * Zustand. POST /:sheetId/reconcile applique un état partiel ou complet (payload
 * de 1 à 5 étapes) — rejouable à chaque ouverture de la fenêtre fiche personnage
 * pendant le Wizard (docs/STE6_FINAL.md). POST /:sheetId/lock verrouille après
 * "Terminer".
 *
 * Routes :
 *   POST   /api/creation/start                  — démarre un brouillon (character + char_sheet)
 *   GET    /api/creation/:sheetId/step3/ref     — données de référence step3 (mutations)
 *   GET    /api/creation/:sheetId/step4/ref     — données de référence step4 (backgrounds + carrières)
 *   GET    /api/creation/:sheetId/step4         — état courant step4 (archetype + carrières)
 *   GET    /api/creation/:sheetId/step5/ref     — liste ref_advantages
 *   GET    /api/creation/:sheetId/preview       — lecture brouillon (fenêtre fiche personnage)
 *   POST   /api/creation/:sheetId/reconcile     — applique l'état courant (payload partiel ou complet)
 *   POST   /api/creation/:sheetId/lock          — verrouille la fiche (fin du Wizard)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getStep3RefData,
  getStep4RefData, getStep4State, getStep5RefData,
  startCreation, reconcileCreation, lockWizard, getCharacterPreview,
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

// ─── Step 3 ────────────────────────────────────────────────────────────────────

router.get('/:sheetId/step3/ref', async (req, res, next) => {
  try {
    const ref = await getStep3RefData()
    res.json(ref)
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
    const advantages = await getStep5RefData(req.character.campaign_id)
    res.json(advantages)
  } catch (err) { next(err) }
})

// ─── Preview ───────────────────────────────────────────────────────────────────

router.get('/:sheetId/preview', async (req, res, next) => {
  try {
    const character = await getCharacterPreview(req.character.id, req.isGm)
    res.json({ character, isGm: req.isGm })
  } catch (err) { next(err) }
})

// ─── Reconcile ─────────────────────────────────────────────────────────────────

router.post('/:sheetId/reconcile', async (req, res, next) => {
  try {
    const { step1, step2, step3, step4, step5 } = req.body
    const result = await reconcileCreation(req.sheet.id, { step1, step2, step3, step4, step5 })
    res.json(result)
  } catch (err) { next(err) }
})

// ─── Lock ──────────────────────────────────────────────────────────────────────

router.post('/:sheetId/lock', async (req, res, next) => {
  try {
    const result = await lockWizard(req.sheet.id)
    res.json(result)
  } catch (err) { next(err) }
})

export default router
