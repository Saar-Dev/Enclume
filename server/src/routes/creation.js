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
 *   POST   /api/creation/start                  — démarre un brouillon (character + char_sheet),
 *                                                  idempotent, targetUserId réservé au MJ
 *   GET    /api/creation/campaign/:campaignId/drafts — brouillons actifs de la campagne (Lot A3)
 *   GET    /api/creation/:sheetId/state         — état réconcilié complet (step1-5, Lot A3 —
 *                                                  step4.skillAllocations best-effort, voir creationService.js)
 *   GET    /api/creation/:sheetId/step3/ref     — données de référence step3 (mutations)
 *   GET    /api/creation/:sheetId/step4/ref     — données de référence step4 (backgrounds + carrières)
 *   GET    /api/creation/:sheetId/step4         — état courant step4 (archetype + carrières)
 *   GET    /api/creation/:sheetId/step5/ref     — liste ref_advantages
 *   GET    /api/creation/:sheetId/preview       — lecture brouillon (fenêtre fiche personnage)
 *   GET    /api/creation/:sheetId/locks         — verrous MJ actifs (docs/PLAN_WIZARDCOLLAB.md)
 *   PUT    /api/creation/:sheetId/locks         — bascule un seul verrou (MJ uniquement)
 *   POST   /api/creation/:sheetId/reconcile     — applique l'état courant (payload partiel ou complet)
 *   POST   /api/creation/:sheetId/lock          — verrouille la fiche (fin du Wizard)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { WS } from '../../../shared/events.js'
import { requireAuth } from '../middleware/auth.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import {
  getStep3RefData,
  getStep4RefData, getStep4State, getStep5RefData,
  getStep1State, getStep2State, getStep3State, getStep5State,
  startCreation, reconcileCreation, lockWizard, getCharacterPreview,
  resolveSheetAccess, getWizardLocks, toggleWizardLock,
} from '../services/creationService.js'

const router = Router()

router.use(requireAuth)

// Extrait dans creationService.js#resolveSheetAccess (docs/PLAN_WIZARDCOLLAB.md Lot A1) — même
// comportement, partagé avec les handlers WebSocket (socket/socketWizard.js).
router.param('sheetId', async (req, res, next, sheetId) => {
  try {
    const { sheet, character, isGm } = await resolveSheetAccess(sheetId, req.user.id)
    req.sheet = sheet
    req.character = character
    req.isGm = isGm
    next()
  } catch (err) { next(err) }
})

// ─── Start ─────────────────────────────────────────────────────────────────────

router.post('/start', async (req, res, next) => {
  try {
    const { campaignId, targetUserId } = req.body
    if (!campaignId) return next(new AppError(400, 'campaignId requis'))

    const member = await db('campaign_members')
      .where({ campaign_id: campaignId, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, "Vous n'êtes pas membre de cette campagne"))

    let ownerUserId = req.user.id
    if (targetUserId) {
      // docs/PLAN_WIZARDCOLLAB.md §4.2 — le MJ peut démarrer un brouillon pour un joueur ciblé.
      if (member.role !== 'gm') return next(new AppError(403, 'Seul le MJ peut démarrer un brouillon pour un autre joueur'))
      const targetMember = await db('campaign_members')
        .where({ campaign_id: campaignId, user_id: targetUserId })
        .first()
      if (!targetMember) return next(new AppError(400, "Le joueur ciblé n'est pas membre de cette campagne"))
      ownerUserId = targetUserId
    }

    const result = await startCreation(campaignId, ownerUserId)
    res.json(result)
  } catch (err) { next(err) }
})

// ─── Brouillons de campagne (Wizard collaboratif, docs/PLAN_WIZARDCOLLAB.md Lot A3) ─────────────

router.get('/campaign/:campaignId/drafts', async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const member = await db('campaign_members')
      .where({ campaign_id: campaignId, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, "Vous n'êtes pas membre de cette campagne"))

    const query = db('char_sheet as cs')
      .join('characters as c', 'c.id', 'cs.character_id')
      .leftJoin('users as u', 'u.id', 'c.user_id')
      .where({ 'c.campaign_id': campaignId })
      .whereNull('cs.wizard_locked_at')
      .whereNotNull('c.user_id')
      .select(
        'cs.id as sheetId', 'c.id as characterId', 'u.username as ownerName',
        'c.user_id as ownerUserId', 'cs.creation_state as creationState', 'cs.updated_at as updatedAt',
      )
    // Pour un joueur : uniquement son propre brouillon. Pour le MJ : tous les JOUEURS (jamais
    // lui-même — la page sert à assister un joueur, pas à lister les essais du MJ sur son propre
    // Wizard) ; whereNotNull('c.user_id') ci-dessus exclut aussi les personnages sans propriétaire
    // (PNJ créés autrement), hors sujet de cette liste.
    if (member.role !== 'gm') query.where({ 'c.user_id': req.user.id })
    else query.whereNot({ 'c.user_id': req.user.id })

    const drafts = await query
    res.json({ drafts })
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

// ─── État complet du brouillon (Wizard collaboratif, docs/PLAN_WIZARDCOLLAB.md Lot A3) ──────────
// step4.skillAllocations/autodidacteAllocations reviennent vides (best-effort assumé, voir
// commentaire au-dessus de getStep4State dans creationService.js). updatedAt sert au log de conflit
// MJ/joueur non bloquant (§4.5) : le client le republie dans reconcile en seenUpdatedAt.

router.get('/:sheetId/state', async (req, res, next) => {
  try {
    const [step1, step2, step3, step4, step5, settings] = await Promise.all([
      getStep1State(req.sheet.id),
      getStep2State(req.sheet.id),
      getStep3State(req.sheet.id),
      getStep4State(req.sheet.id),
      getStep5State(req.sheet.id),
      getCampaignSettings(db, req.character.campaign_id),
    ])
    res.json({
      step1, step2, step3, step4, step5,
      updatedAt: req.sheet.updated_at,
      isGm: req.isGm,
      ownerUserId: req.character.user_id,
      characterId: req.character.id,
      campaignId: req.character.campaign_id,
      ambiance: settings.ambiance,
      randomMutationsEnabled: settings.random_mutations,
      femininBonusEnabled: settings.feminin_bonus,
      randomProAdvantagesEnabled: settings.random_pro_advantages,
      reversEnabled: settings.revers,
      skillMaxLevelEnabled: settings.skill_max_level,
      youngPenaltyEnabled: settings.young_penalty,
    })
  } catch (err) { next(err) }
})

// ─── Preview ───────────────────────────────────────────────────────────────────

router.get('/:sheetId/preview', async (req, res, next) => {
  try {
    const character = await getCharacterPreview(req.character.id, req.isGm)
    res.json({ character, isGm: req.isGm })
  } catch (err) { next(err) }
})

// ─── Verrous MJ (Wizard collaboratif, docs/PLAN_WIZARDCOLLAB.md Lot A1) ─────────────────────────

router.get('/:sheetId/locks', async (req, res, next) => {
  try {
    const locks = await getWizardLocks(req.sheet.id)
    res.json({ locks })
  } catch (err) { next(err) }
})

router.put('/:sheetId/locks', async (req, res, next) => {
  try {
    if (!req.isGm) return next(new AppError(403, 'Seul le MJ peut poser un verrou'))
    const { step, optionKey, locked } = req.body
    if (!Number.isInteger(step) || step < 1 || step > 5) return next(new AppError(400, 'step invalide'))
    if (!optionKey || typeof optionKey !== 'string') return next(new AppError(400, 'optionKey requis'))

    const locks = await toggleWizardLock(req.sheet.id, step, optionKey, !!locked)
    req.app.get('io').to(`wizard:${req.sheet.id}`).emit(WS.WIZARD_LOCKS_SYNC, { sheetId: req.sheet.id, locks })
    res.json({ locks })
  } catch (err) { next(err) }
})

// ─── Reconcile ─────────────────────────────────────────────────────────────────

router.post('/:sheetId/reconcile', async (req, res, next) => {
  try {
    const { step1, step2, step3, step4, step5, finalize } = req.body
    const result = await reconcileCreation(req.sheet.id, { step1, step2, step3, step4, step5, finalize }, req.isGm)
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
