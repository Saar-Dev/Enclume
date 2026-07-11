// vault.js — PLAN_VAULT.md Étapes 5+6. Routes /api/vault/*.
// Deux familles distinctes de char-sheet.js par conception (voir PLAN_VAULT.md "Architecture
// cible") : un personnage en Vault est un instantané figé, jamais traversé par les routes de
// mutation de char-sheet.js. Ownership seule ici (pas de campaign_members — un Vault n'a pas de
// membres).

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  listVaultCharacters, requestImport, approveImport, rejectImport, listPendingRequestsForCampaign,
} from '../services/vaultService.js'

const router = Router()

router.use(requireAuth)

// ─── Ownership sur toutes les routes /characters/:id ────────────────────────────────────────
router.param('id', async (req, res, next, id) => {
  try {
    const character = await db('characters').where({ id }).first()
    if (!character) return next(new AppError(404, 'Personnage introuvable'))
    if (!character.vault_id) return next(new AppError(404, "Ce personnage n'est pas dans un Vault"))
    if (character.user_id !== req.user.id) return next(new AppError(403, 'Accès refusé'))
    req.vaultCharacter = character
    next()
  } catch (err) { next(err) }
})

// GET /api/vault/characters — liste des personnages du Vault de l'utilisateur connecté
router.get('/characters', async (req, res, next) => {
  try {
    const characters = await listVaultCharacters(req.user.id)
    res.json({ characters })
  } catch (err) { next(err) }
})

// GET /api/vault/characters/:id — fiche en lecture. Scope volontairement réduit par rapport à
// GET /char-sheet/:characterId (sheet+identity+archetype+attributes+skills, pas settings/
// mutationEffects — dépendent d'une campagne, qu'un personnage en Vault n'a pas).
router.get('/characters/:id', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet').where({ character_id: req.vaultCharacter.id }).first()
    if (!sheet) {
      return res.json({ character: req.vaultCharacter, sheet: null })
    }
    const [identity, archetype, attributes, skills] = await Promise.all([
      db('char_identity').where({ char_sheet_id: sheet.id }).first(),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
      db('char_skills').where({ char_sheet_id: sheet.id }).select('*'),
    ])
    res.json({
      character: req.vaultCharacter,
      sheet,
      identity: identity || null,
      archetype: archetype || null,
      attributes: attributes || [],
      skills: skills || [],
    })
  } catch (err) { next(err) }
})

// PATCH /api/vault/characters/:id — renommage uniquement (scope minimal, PLAN_VAULT.md)
router.patch('/characters/:id', async (req, res, next) => {
  try {
    const { name } = req.body
    if (typeof name !== 'string' || !name.trim()) throw new AppError(400, 'Nom invalide')
    const [updated] = await db('characters')
      .where({ id: req.vaultCharacter.id })
      .update({ name: name.trim() })
      .returning('*')
    res.json({ character: updated })
  } catch (err) { next(err) }
})

// DELETE /api/vault/characters/:id — suppression définitive (cascade tout le sous-arbre)
router.delete('/characters/:id', async (req, res, next) => {
  try {
    await db('characters').where({ id: req.vaultCharacter.id }).delete()
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// POST /api/vault/characters/:id/request-import — Décision 3 "depuis le Vault" (restreint)
router.post('/characters/:id/request-import', async (req, res, next) => {
  try {
    const { targetCampaignId } = req.body
    if (!targetCampaignId) throw new AppError(400, 'targetCampaignId requis')
    const request = await requestImport(req.vaultCharacter.id, targetCampaignId, req.user.id)
    res.status(201).json({ request })
  } catch (err) { next(err) }
})

// ─── Décisions du MJ de la campagne cible sur une demande — pas de router.param dédié, la
// vérification MJ + l'existence de la demande sont déjà entièrement faites dans le service. ────

// GET /api/vault/campaigns/:campaignId/transfer-requests — vue MJ (PLAN_VAULT.md Étape 7 Lot 4)
router.get('/campaigns/:campaignId/transfer-requests', async (req, res, next) => {
  try {
    const requests = await listPendingRequestsForCampaign(req.params.campaignId, req.user.id)
    res.json({ requests })
  } catch (err) { next(err) }
})

// POST /api/vault/transfer-requests/:requestId/approve
router.post('/transfer-requests/:requestId/approve', async (req, res, next) => {
  try {
    const character = await approveImport(req.params.requestId, req.user.id)
    res.json({ character })
  } catch (err) { next(err) }
})

// POST /api/vault/transfer-requests/:requestId/reject
router.post('/transfer-requests/:requestId/reject', async (req, res, next) => {
  try {
    const result = await rejectImport(req.params.requestId, req.user.id)
    res.json(result)
  } catch (err) { next(err) }
})

export default router
