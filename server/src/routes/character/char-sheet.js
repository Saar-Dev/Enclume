/**
 * char-sheet.js — Routes fiche personnage Polaris
 *
 * Monté sous /api/char-sheet dans index.js.
 *
 * Ownership : joueur propriétaire (characters.user_id === req.user.id) OU rôle GM.
 * Toutes les routes vérifient l'ownership avant toute opération.
 *
 * Routes :
 *   GET    /api/char-sheet/:characterId              — fiche complète (toutes tables)
 *   POST   /api/char-sheet/:characterId              — crée une fiche vide
 *   PUT    /api/char-sheet/:characterId/identity     — sauvegarde identité
 *   PUT    /api/char-sheet/:characterId/archetype    — sauvegarde archétype
 *   PUT    /api/char-sheet/:characterId/attributes   — sauvegarde attributs (bulk upsert)
 *   PUT    /api/char-sheet/:characterId/skills       — sauvegarde compétences (bulk upsert)
 *   PUT    /api/char-sheet/:characterId/chc          — sauvegarde Chance
 *   PUT    /api/char-sheet/:characterId/xp           — modifie solde XP (GM uniquement)
 *   POST   /api/char-sheet/:characterId/skills/buy   — dépense XP pour augmenter une compétence
 *   GET    /api/char-sheet/:characterId/advantages   — liste avantages/désavantages
 *   POST   /api/char-sheet/:characterId/advantages   — ajoute un avantage/désavantage
 *   DELETE /api/char-sheet/:characterId/advantages/:id — supprime un avantage/désavantage
 */

import { Router } from 'express'
import db from '../../db/knex.js'
import { AppError } from '../../lib/AppError.js'
import { requireAuth } from '../../middleware/auth.js'
import { getCoutAugmentation, getCoutDeblocageX } from '../../lib/charStats.js'

const router = Router()

// ─── Helper ownership ─────────────────────────────────────────────────────────
// Vérifie que req.user est propriétaire du character OU GM de la campagne.
// Retourne { character, isGm } si autorisé, lève AppError sinon.
async function assertOwnerOrGm(characterId, userId) {
  const character = await db('characters').where({ id: characterId }).first()
  if (!character) throw new AppError(404, 'Character not found')

  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: userId })
    .first()
  if (!member) throw new AppError(403, 'You are not a member of this campaign')

  const isOwner = character.user_id && character.user_id === userId
  const isGm = member.role === 'gm'

  if (!isOwner && !isGm) throw new AppError(403, 'You do not have permission to access this sheet')

  return { character, isGm }
}

// ─── GET /api/char-sheet/:characterId ────────────────────────────────────────
// Retourne la fiche complète en une seule réponse :
// sheet (inclut xp_total, xp_available) + identity + archetype + attributes + skills
// Retourne null pour chaque section manquante — le client crée ce qui manque.
router.get('/:characterId', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()

    if (!sheet) {
      return res.json({ sheet: null })
    }

    const [identity, archetype, attributes, skills] = await Promise.all([
      db('char_identity').where({ char_sheet_id: sheet.id }).first(),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
      db('char_skills').where({ char_sheet_id: sheet.id }).select('*'),
    ])

    res.json({
      sheet,
      identity:   identity   || null,
      archetype:  archetype  || null,
      attributes: attributes || [],
      skills:     skills     || [],
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/char-sheet/:characterId ───────────────────────────────────────
// Crée une fiche vide pour un character existant.
// Initialise aussi char_identity, char_archetype, et les 8 lignes char_attributes.
// 409 si une fiche existe déjà pour ce character.
router.post('/:characterId', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const existing = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (existing) throw new AppError(409, 'A sheet already exists for this character')

    const result = await db.transaction(async (trx) => {
      const [sheet] = await trx('char_sheet')
        .insert({ character_id: req.params.characterId })
        .returning('*')

      await trx('char_identity').insert({ char_sheet_id: sheet.id })
      await trx('char_archetype').insert({ char_sheet_id: sheet.id })

      const ATTRS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']
      await trx('char_attributes').insert(
        ATTRS.map(attr_id => ({
          char_sheet_id: sheet.id,
          attr_id,
          base_level: 7,
          pc_modifier: 0,
        }))
      )

      return sheet
    })

    res.status(201).json({ sheet: result })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/identity ───────────────────────────────
router.put('/:characterId/identity', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const {
      player_name, char_name,
      height, weight,
      skin, eyes, hair, build,
      distinctive_signs, hand_pref,
    } = req.body

    const updates = {}
    if (player_name        !== undefined) updates.player_name        = player_name
    if (char_name          !== undefined) updates.char_name          = char_name
    if (height             !== undefined) updates.height             = height
    if (weight             !== undefined) updates.weight             = weight
    if (skin               !== undefined) updates.skin               = skin
    if (eyes               !== undefined) updates.eyes               = eyes
    if (hair               !== undefined) updates.hair               = hair
    if (build              !== undefined) updates.build              = build
    if (distinctive_signs  !== undefined) updates.distinctive_signs  = distinctive_signs
    if (hand_pref          !== undefined) updates.hand_pref          = hand_pref

    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const [updated] = await db('char_identity')
      .where({ char_sheet_id: sheet.id })
      .update(updates)
      .returning('*')

    res.json({ identity: updated })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/archetype ──────────────────────────────
router.put('/:characterId/archetype', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const {
      genotype_id, age, sex, is_fertile,
      origin_geo, origin_soc, training_base, higher_ed,
    } = req.body

    const updates = {}
    if (genotype_id    !== undefined) updates.genotype_id    = genotype_id
    if (age            !== undefined) updates.age            = age
    if (sex            !== undefined) updates.sex            = sex
    if (is_fertile     !== undefined) updates.is_fertile     = is_fertile
    if (origin_geo     !== undefined) updates.origin_geo     = origin_geo
    if (origin_soc     !== undefined) updates.origin_soc     = origin_soc
    if (training_base  !== undefined) updates.training_base  = training_base
    if (higher_ed      !== undefined) updates.higher_ed      = higher_ed

    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const [updated] = await db('char_archetype')
      .where({ char_sheet_id: sheet.id })
      .update(updates)
      .returning('*')

    res.json({ archetype: updated })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/attributes ─────────────────────────────
router.put('/:characterId/attributes', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { attributes } = req.body
    if (!Array.isArray(attributes) || attributes.length === 0) {
      throw new AppError(400, 'attributes must be a non-empty array')
    }

    const VALID_ATTRS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

    for (const attr of attributes) {
      if (!VALID_ATTRS.includes(attr.attr_id)) {
        throw new AppError(400, `Invalid attr_id: ${attr.attr_id}`)
      }
      if (!Number.isInteger(attr.base_level) || attr.base_level < 1) {
        throw new AppError(400, `base_level must be a positive integer for ${attr.attr_id}`)
      }
      if (attr.pc_modifier !== undefined && !Number.isInteger(attr.pc_modifier)) {
        throw new AppError(400, `pc_modifier must be an integer for ${attr.attr_id}`)
      }
    }

    await db('char_attributes')
      .insert(
        attributes.map(attr => ({
          char_sheet_id: sheet.id,
          attr_id:       attr.attr_id,
          base_level:    attr.base_level,
          pc_modifier:   attr.pc_modifier ?? 0,
        }))
      )
      .onConflict(['char_sheet_id', 'attr_id'])
      .merge(['base_level', 'pc_modifier'])

    const updated = await db('char_attributes')
      .where({ char_sheet_id: sheet.id })
      .select('*')

    res.json({ attributes: updated })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/skills ─────────────────────────────────
// Sauvegarde compétences en bulk (upsert) — usage direct GM ou debounce joueur.
// Cette route reste disponible pour la saisie directe de maîtrise par le GM.
router.put('/:characterId/skills', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { skills } = req.body
    if (!Array.isArray(skills) || skills.length === 0) {
      throw new AppError(400, 'skills must be a non-empty array')
    }

    const skillIds = skills.map(s => s.skill_id)
    const existing = await db('ref_skills').whereIn('id', skillIds).select('id')
    const existingIds = new Set(existing.map(r => r.id))
    const unknown = skillIds.filter(id => !existingIds.has(id))
    if (unknown.length > 0) {
      throw new AppError(400, `Unknown skill_id(s): ${unknown.join(', ')}`)
    }

    await db('char_skills')
      .insert(
        skills.map(skill => ({
          char_sheet_id: sheet.id,
          skill_id:      skill.skill_id,
          mastery:       skill.mastery       ?? 0,
          is_learned:    skill.is_learned    ?? false,
        }))
      )
      .onConflict(['char_sheet_id', 'skill_id'])
      .merge(['mastery', 'is_learned'])

    const updated = await db('char_skills')
      .where({ char_sheet_id: sheet.id })
      .select('*')

    res.json({ skills: updated })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/chc ────────────────────────────────────
router.put('/:characterId/chc', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { chc } = req.body
    if (!Number.isInteger(chc) || chc < 1 || chc > 20) {
      throw new AppError(400, 'chc must be an integer between 1 and 20')
    }

    const [updated] = await db('char_sheet')
      .where({ id: sheet.id })
      .update({ chc, updated_at: db.fn.now() })
      .returning('*')

    res.json({ sheet: updated })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/xp ─────────────────────────────────────
// Modifie le solde XP du personnage. Réservé au GM.
// Body : { xp_total?, xp_available? } — au moins un des deux requis.
// Le GM peut ajuster indépendamment le total reçu et le disponible.
router.put('/:characterId/xp', requireAuth, async (req, res, next) => {
  try {
    const { isGm } = await assertOwnerOrGm(req.params.characterId, req.user.id)
    if (!isGm) throw new AppError(403, 'Only the GM can modify XP')

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { xp_total, xp_available } = req.body
    const updates = {}

    if (xp_total !== undefined) {
      if (!Number.isInteger(xp_total) || xp_total < 0) {
        throw new AppError(400, 'xp_total must be a non-negative integer')
      }
      updates.xp_total = xp_total
    }

    if (xp_available !== undefined) {
      if (!Number.isInteger(xp_available) || xp_available < 0) {
        throw new AppError(400, 'xp_available must be a non-negative integer')
      }
      updates.xp_available = xp_available
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'At least one of xp_total or xp_available is required')
    }

    // P13 — updated_at après le guard Object.keys
    updates.updated_at = db.fn.now()

    const [updated] = await db('char_sheet')
      .where({ id: sheet.id })
      .update(updates)
      .returning('*')

    res.json({ sheet: updated })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/char-sheet/:characterId/skills/buy ────────────────────────────
// Dépense des XP pour augmenter d'un niveau la maîtrise d'une compétence,
// ou débloquer une compétence (X) (coût fixe 3 PE, is_learned → true).
//
// Logique :
//   1. Charger char_skills pour ce skill_id (mastery, is_learned)
//   2. Charger ref_skills pour ce skill_id (marker)
//   3. Si marker='(X)' et is_learned=false → coût fixe 3 PE, is_learned → true
//   4. Sinon → coût = getCoutAugmentation(mastery), mastery += 1
//   5. Vérifier xp_available >= coût
//   6. UPSERT char_skills + UPDATE char_sheet xp_available
//   7. Retourner { skill_id, mastery, is_learned, xp_available }
//
// Note P46 : déclarée AVANT POST /:characterId/advantages (route spécifique avant paramétrique).
router.post('/:characterId/skills/buy', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { skill_id } = req.body
    if (!skill_id || typeof skill_id !== 'string') {
      throw new AppError(400, 'skill_id is required')
    }

    // Vérifier que la compétence existe
    const refSkill = await db('ref_skills').where({ id: skill_id }).first()
    if (!refSkill) throw new AppError(404, `Skill not found: ${skill_id}`)

    // Charger l'état actuel de la compétence pour ce personnage
    const charSkill = await db('char_skills')
      .where({ char_sheet_id: sheet.id, skill_id })
      .first()

    const currentMastery  = charSkill?.mastery    ?? 0
    const currentLearned  = charSkill?.is_learned  ?? false
    const isXReserved     = refSkill.marker === '(X)'

    // Calculer le coût et les nouvelles valeurs
    let cout
    let newMastery   = currentMastery
    let newIsLearned = currentLearned

    if (isXReserved && !currentLearned) {
      // Déblocage (X) — coût fixe 3 PE, mastery reste 0, is_learned → true
      cout         = getCoutDeblocageX()
      newIsLearned = true
    } else {
      // Progression normale — +1 mastery
      cout       = getCoutAugmentation(currentMastery)
      newMastery = currentMastery + 1
    }

    // Vérifier que le personnage a assez d'XP
    if (sheet.xp_available < cout) {
      throw new AppError(400, `XP insuffisants : ${sheet.xp_available} disponibles, ${cout} requis`)
    }

    // Transaction : UPSERT char_skills + décrémenter xp_available
    await db.transaction(async (trx) => {
      await trx('char_skills')
        .insert({
          char_sheet_id: sheet.id,
          skill_id,
          mastery:    newMastery,
          is_learned: newIsLearned,
        })
        .onConflict(['char_sheet_id', 'skill_id'])
        .merge(['mastery', 'is_learned'])

      await trx('char_sheet')
        .where({ id: sheet.id })
        .update({
          xp_available: sheet.xp_available - cout,
          updated_at:   trx.fn.now(),
        })
    })

    res.json({
      skill_id,
      mastery:      newMastery,
      is_learned:   newIsLearned,
      xp_available: sheet.xp_available - cout,
      cout,
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-sheet/:characterId/advantages ─────────────────────────────
router.get('/:characterId/advantages', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) return res.json({ advantages: [] })

    const advantages = await db('char_advantages')
      .leftJoin('ref_mutations', 'char_advantages.muta_numero', 'ref_mutations.muta_numero')
      .where({ 'char_advantages.char_sheet_id': sheet.id })
      .select(
        'char_advantages.id',
        'char_advantages.type',
        'char_advantages.muta_numero',
        'char_advantages.label',
        'char_advantages.level',
        'char_advantages.created_at',
        'ref_mutations.nom as mutation_nom',
        'ref_mutations.linked_skill_id',
      )
      .orderBy('char_advantages.created_at', 'asc')

    res.json({ advantages })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/char-sheet/:characterId/advantages ────────────────────────────
router.post('/:characterId/advantages', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { type, muta_numero, label } = req.body

    if (!['MUTATION', 'OTHER'].includes(type)) {
      throw new AppError(400, "type must be 'MUTATION' or 'OTHER'")
    }

    if (type === 'MUTATION') {
      if (!muta_numero) throw new AppError(400, 'muta_numero is required for type MUTATION')
      const mutation = await db('ref_mutations').where({ muta_numero }).first()
      if (!mutation) throw new AppError(404, `Mutation ${muta_numero} not found`)

      const existing = await db('char_advantages')
        .where({ char_sheet_id: sheet.id, type: 'MUTATION', muta_numero })
        .first()

      if (existing) {
        const [updated] = await db('char_advantages')
          .where({ id: existing.id })
          .update({ level: existing.level + 1 })
          .returning('*')
        return res.json({ advantage: updated })
      }

      const [inserted] = await db('char_advantages')
        .insert({ char_sheet_id: sheet.id, type: 'MUTATION', muta_numero, level: 1 })
        .returning('*')
      return res.status(201).json({ advantage: inserted })
    }

    if (type === 'OTHER') {
      if (!label || typeof label !== 'string' || label.trim().length === 0) {
        throw new AppError(400, 'label is required and must be non-empty for type OTHER')
      }
      if (label.length > 255) {
        throw new AppError(400, 'label must be 255 characters or less')
      }

      const [inserted] = await db('char_advantages')
        .insert({ char_sheet_id: sheet.id, type: 'OTHER', label: label.trim() })
        .returning('*')
      return res.status(201).json({ advantage: inserted })
    }
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/char-sheet/:characterId/advantages/:id ──────────────────────
router.delete('/:characterId/advantages/:id', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const advantage = await db('char_advantages')
      .where({ id: req.params.id, char_sheet_id: sheet.id })
      .first()
    if (!advantage) throw new AppError(404, 'Advantage not found')

    if (advantage.type === 'MUTATION' && advantage.level > 1) {
      const [updated] = await db('char_advantages')
        .where({ id: advantage.id })
        .update({ level: advantage.level - 1 })
        .returning('*')
      return res.json({ advantage: updated })
    }

    await db('char_advantages').where({ id: advantage.id }).del()
    res.json({ deleted: true, id: advantage.id })
  } catch (err) {
    next(err)
  }
})

export default router
