// vault.js — PLAN_VAULT.md Étapes 5+6. Routes /api/vault/*.
// Scope volontairement réduit ici (lecture, renommage, suppression, demande de transfert) —
// l'édition complète (identité, attributs, compétences, inventaire...) passe par char-sheet.js,
// ouverte au propriétaire via req.isVaultOwner depuis le chantier Coffre (docs/EN_COURS.md,
// 2026-08-16) : un personnage du Coffre n'est PLUS un instantané figé par défaut, c'est un espace
// personnel librement éditable par son propriétaire (ancien invariant "gelé dès wizard_locked_at",
// PLAN_VAULT.md "Architecture cible", abandonné — le contrôle se fait désormais à la frontière, au
// transfert vers une campagne, pas par un flag technique interne). Ownership seule ici (pas de
// campaign_members — un Vault n'a pas de membres).

import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import {
  listVaultCharacters, requestImport, approveImport, rejectImport, listPendingRequestsForCampaign,
  getOrCreateVault,
} from '../services/vaultService.js'
import { createCompanionSheet } from '../services/charSheetService.js'
import { resolveOwnership } from '../services/characterOwnershipService.js'

// Types créables directement dans le Coffre — jamais 'pnj' (n'a de sens qu'au sein d'un roster de
// campagne, cf. resolveOwnership) ni 'vaisseau' (pas encore implémenté, COMPANION_REGISTRY).
const VAULT_CREATABLE_TYPES = ['pj', 'drone', 'exo']

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

// POST /api/vault/characters — création directe dans le Coffre (sans Wizard), propriétaire = seule
// autorité (docs/EN_COURS.md, 2026-08-16 — "propriétaire du Coffre = seule autorité", aucune notion
// de MJ hors campagne, cf. l'interdiction formelle de réutiliser users.role='admin' comme raccourci
// ici). Miroir de POST /api/campaigns/:campaignId/characters (routes/characters.js) sans campagne :
// même autorité de couleur (resolveOwnership avec campaignId=null retombe toujours sur 'pj', color
// dérivée de l'utilisateur) et même autorité de fiche (createCompanionSheet, désormais partagée par
// les deux routes plutôt que dupliquée).
router.post('/characters', async (req, res, next) => {
  try {
    const { name, type } = req.body
    if (typeof name !== 'string' || !name.trim()) throw new AppError(400, 'Nom invalide')
    if (!VAULT_CREATABLE_TYPES.includes(type)) {
      throw new AppError(400, `type doit être l'un de : ${VAULT_CREATABLE_TYPES.join(', ')}`)
    }

    const vault = await getOrCreateVault(req.user.id)
    const ownership = await resolveOwnership(db, { campaignId: null, userId: req.user.id })

    const character = await db.transaction(async (trx) => {
      const [character] = await trx('characters')
        .insert({
          vault_id: vault.id, user_id: req.user.id, name: name.trim(),
          color: ownership.color, visible: false, type,
        })
        .returning('*')

      await createCompanionSheet(trx, { characterId: character.id, type })

      return character
    })

    res.status(201).json({ character })
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
