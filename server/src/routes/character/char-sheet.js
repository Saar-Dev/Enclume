/**
 * char-sheet.js — Routes fiche personnage Polaris
 *
 * Monté sous /api/char-sheet dans index.js.
 *
 * Ownership : router.use(requireAuth) + router.param('characterId', ...) assurent
 * auth + ownership (owner OU GM) avant chaque handler. req.character et req.isGm
 * sont disponibles dans toutes les routes /:characterId.
 *
 * Routes :
 *   GET    /api/char-sheet/:characterId              — fiche complète (toutes tables)
 *   POST   /api/char-sheet/:characterId              — crée une fiche vide
 *   PUT    /api/char-sheet/:characterId/identity     — sauvegarde identité
 *   PUT    /api/char-sheet/:characterId/archetype    — sauvegarde archétype
 *   PUT    /api/char-sheet/:characterId/attributes   — sauvegarde attributs (bulk upsert)
 *   PUT    /api/char-sheet/:characterId/skills                      — sauvegarde compétences (bulk upsert)
 *   PUT    /api/char-sheet/:characterId/skills/toggle-learned      — toggle is_learned pouvoir Polaris (owner ou GM)
 *   PUT    /api/char-sheet/:characterId/chc          — sauvegarde Chance
 *   PUT    /api/char-sheet/:characterId/xp           — modifie solde XP (GM uniquement)
 *   POST   /api/char-sheet/:characterId/skills/buy   — dépense XP pour augmenter une compétence
 *   GET    /api/char-sheet/:characterId/advantages   — liste avantages/désavantages
 *   POST   /api/char-sheet/:characterId/advantages   — ajoute un avantage/désavantage
 *   DELETE /api/char-sheet/:characterId/advantages/:id — supprime un avantage/désavantage
 *   GET    /api/char-sheet/:characterId/wounds       — liste blessures du personnage
 *   POST   /api/char-sheet/:characterId/wounds       — ajoute une blessure (+ promotion auto)
 *   PUT    /api/char-sheet/:characterId/wounds/:woundId/stabilize — stabilise une blessure
 *   DELETE /api/char-sheet/:characterId/wounds/:woundId — supprime une blessure (guérison)
 *   GET    /api/char-sheet/:characterId/macros              — liste macros du personnage
 *   POST   /api/char-sheet/:characterId/macros              — crée une macro (max 10)
 *   PUT    /api/char-sheet/:characterId/macros/:macroId     — modifie label/sources/modifier/template/sort_order
 *   DELETE /api/char-sheet/:characterId/macros/:macroId     — supprime une macro
 *   GET    /api/char-sheet/:characterId/macro-options       — options pour formulaire création (attributs, compétences, secondaires)
 *   POST   /api/char-sheet/:characterId/macro-preview       — calcule le seuil live { sources, modifier } → { threshold }
 */

import { Router } from 'express'
import db from '../../db/knex.js'
import { AppError } from '../../lib/AppError.js'
import { requireAuth } from '../../middleware/auth.js'
import { getCoutAugmentation, getCoutDeblocageX, calcEncumbrancePenalty, calcWoundPenalty, calcSkillTotal, calcAttributeNA, calcREA, calcSeuils, calcSouffle, calcResistanceDroguesInput } from '../../lib/charStats.js'
import { resolveWoundInsertion, isShockTestRequired } from '../../lib/woundUtils.js'
import { WS } from '../../../../shared/events.js'
import {
  WOUND_LOCATIONS, WOUND_SEVERITIES,
} from '../../../../shared/woundConstants.js'

const router = Router()

// ─── Auth + Ownership automatique sur toutes les routes /:characterId ──────────
router.use(requireAuth)

router.param('characterId', async (req, res, next, characterId) => {
  try {
    const character = await db('characters').where({ id: characterId }).first()
    if (!character) return next(new AppError(404, 'Character not found'))

    const member = await db('campaign_members')
      .where({ campaign_id: character.campaign_id, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, 'You are not a member of this campaign'))

    req.character = character
    req.isGm     = member.role === 'gm'

    const isOwner = character.user_id === req.user.id
    if (!isOwner && !req.isGm) return next(new AppError(403, 'You do not have permission to access this sheet'))

    next()
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId ────────────────────────────────────────
// Retourne la fiche complète en une seule réponse :
// sheet (inclut xp_total, xp_available) + identity + archetype + attributes + skills
// Retourne null pour chaque section manquante — le client crée ce qui manque.
router.get('/:characterId', async (req, res, next) => {
  try {
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
router.post('/:characterId', async (req, res, next) => {
  try {
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
router.put('/:characterId/identity', async (req, res, next) => {
  try {
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
router.put('/:characterId/archetype', async (req, res, next) => {
  try {
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
router.put('/:characterId/attributes', async (req, res, next) => {
  try {
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

// ─── PUT /api/char-sheet/:characterId/skills/toggle-learned ──────────────────
// Toggle is_learned sur un pouvoir Polaris — owner ou GM.
// Restreint aux compétences parent='POUVOIRS_POLARIS' pour ne pas contourner
// le gate XP des compétences (X) ordinaires (qui passent par POST /skills/buy).
router.put('/:characterId/skills/toggle-learned', async (req, res, next) => {
  try {
    const { skill_id, is_learned } = req.body
    if (!skill_id || typeof skill_id !== 'string') {
      throw new AppError(400, 'skill_id est requis')
    }
    if (typeof is_learned !== 'boolean') {
      throw new AppError(400, 'is_learned doit être un booléen')
    }

    const refSkill = await db('ref_skills').where({ id: skill_id }).first()
    if (!refSkill) throw new AppError(404, `Compétence introuvable : ${skill_id}`)
    if (refSkill.parent !== 'POUVOIRS_POLARIS') {
      throw new AppError(400, 'Cette route est réservée aux pouvoirs Polaris')
    }

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    await db('char_skills')
      .insert({ char_sheet_id: sheet.id, skill_id, mastery: 0, is_learned })
      .onConflict(['char_sheet_id', 'skill_id'])
      .merge(['is_learned'])

    const skill = await db('char_skills')
      .where({ char_sheet_id: sheet.id, skill_id })
      .first()

    res.json({ skill })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/char-sheet/:characterId/skills ─────────────────────────────────
// Sauvegarde compétences en bulk (upsert) — GM uniquement.
// Les joueurs augmentent leur maîtrise exclusivement via POST /skills/buy.
router.put('/:characterId/skills', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'Only the GM can modify skills directly')

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
router.put('/:characterId/chc', async (req, res, next) => {
  try {
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
router.put('/:characterId/xp', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'Only the GM can modify XP')

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
router.post('/:characterId/skills/buy', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { skill_id } = req.body
    if (!skill_id || typeof skill_id !== 'string') {
      throw new AppError(400, 'skill_id is required')
    }

    const refSkill = await db('ref_skills').where({ id: skill_id }).first()
    if (!refSkill) throw new AppError(404, `Skill not found: ${skill_id}`)

    const charSkill = await db('char_skills')
      .where({ char_sheet_id: sheet.id, skill_id })
      .first()

    const currentMastery  = charSkill?.mastery    ?? 0
    const currentLearned  = charSkill?.is_learned  ?? false
    const isXReserved     = refSkill.marker === '(X)'

    let cout
    let newMastery   = currentMastery
    let newIsLearned = currentLearned

    if (isXReserved && !currentLearned) {
      cout         = getCoutDeblocageX()
      newIsLearned = true
    } else {
      cout       = getCoutAugmentation(currentMastery)
      newMastery = currentMastery + 1
    }

    if (sheet.xp_available < cout) {
      throw new AppError(400, `XP insuffisants : ${sheet.xp_available} disponibles, ${cout} requis`)
    }

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
router.get('/:characterId/advantages', async (req, res, next) => {
  try {
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
router.post('/:characterId/advantages', async (req, res, next) => {
  try {
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
router.delete('/:characterId/advantages/:id', async (req, res, next) => {
  try {
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

// ─── Helpers blessures — voir server/src/lib/woundUtils.js ──────────────────

// ─── GET /api/char-sheet/:characterId/wounds ─────────────────────────────────
router.get('/:characterId/wounds', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.json({ wounds: [], wound_penalty: 0 })

    const wounds = await db('character_wounds')
      .where({ char_sheet_id: sheet.id })
      .orderBy('created_at', 'asc')
    res.json({ wounds, wound_penalty: calcWoundPenalty(wounds) })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/wounds ────────────────────────────────
router.post('/:characterId/wounds', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const { location, severity } = req.body
    if (!WOUND_LOCATIONS.includes(location)) throw new AppError(400, `Localisation invalide : ${location}`)
    if (!WOUND_SEVERITIES.includes(severity)) throw new AppError(400, `Gravité invalide : ${severity}`)

    const result = await db.transaction(trx =>
      resolveWoundInsertion(trx, sheet.id, location, severity)
    )

    const shock_test_required = isShockTestRequired(result.wound.severity, result.wound.location)

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_ADDED, {
      characterId: req.params.characterId,
      wound:       result.wound,
      promoted:    result.promoted,
      shock_test_required,
    })

    res.status(201).json({ wound: result.wound, promoted: result.promoted, shock_test_required })
  } catch (err) { next(err) }
})

// ─── PUT /api/char-sheet/:characterId/wounds/:woundId/stabilize ──────────────
// Note P46 : déclarée AVANT DELETE /:characterId/wounds/:woundId
router.put('/:characterId/wounds/:woundId/stabilize', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const wound = await db('character_wounds')
      .where({ id: req.params.woundId, char_sheet_id: sheet.id }).first()
    if (!wound) throw new AppError(404, 'Wound not found')

    const [updated] = await db('character_wounds')
      .where({ id: req.params.woundId })
      .update({ is_stabilized: true, updated_at: db.fn.now() })
      .returning('*')

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_UPDATED, {
      characterId: req.params.characterId,
      wound: updated,
    })

    res.json({ wound: updated })
  } catch (err) { next(err) }
})

// ─── DELETE /api/char-sheet/:characterId/wounds/:woundId ─────────────────────
router.delete('/:characterId/wounds/:woundId', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const wound = await db('character_wounds')
      .where({ id: req.params.woundId, char_sheet_id: sheet.id }).first()
    if (!wound) throw new AppError(404, 'Wound not found')

    await db('character_wounds').where({ id: req.params.woundId }).del()

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_REMOVED, {
      characterId: req.params.characterId,
      woundId: req.params.woundId,
    })

    res.json({ deleted: true, woundId: req.params.woundId })
  } catch (err) { next(err) }
})

// ─── Helpers inventaire ───────────────────────────────────────────────────────

const VALID_CONTAINERS = ['Coffre', 'Sac', 'Ceinture']
const VALID_SLOTS      = ['T', 'C', 'BG', 'BD', 'JG', 'JD', 'D', 'Ce', 'MG', 'MD', '2M', 'Tr']
const ARMOR_SLOTS      = new Set(['T', 'C', 'BG', 'BD', 'JG', 'JD'])
const WEAPON_SLOTS     = new Set(['MG', 'MD', '2M', 'Tr'])

async function isContainerAvailable(characterId, container) {
  if (container === 'Coffre') return true
  const locationNeeded = container === 'Sac' ? 'D' : container === 'Ceinture' ? 'Ce' : null
  if (!locationNeeded) return false
  const row = await db('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .where('ref_equipment.location', locationNeeded)
    .first()
  return !!row
}

async function getDefaultContainer(characterId) {
  const hasSac = await db('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .where('ref_equipment.location', 'D')
    .first()
  return hasSac ? 'Sac' : 'Coffre'
}

async function getItemWithRef(itemId) {
  return db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.id': itemId })
    .select(
      'char_inventory.id',
      'char_inventory.equipment_id',
      'char_inventory.container',
      'char_inventory.slot',
      'char_inventory.quantity',
      'char_inventory.custom_name',
      'char_inventory.custom_desc',
      'char_inventory.notes',
      'char_inventory.custom_props',
      'ref_equipment.name as ref_name',
      'ref_equipment.family as ref_family',
      'ref_equipment.category as ref_category',
      'ref_equipment.weight as ref_weight',
      'ref_equipment.location as ref_location',
      'ref_equipment.protection as ref_protection',
      'ref_equipment.protection_shock as ref_protection_shock',
      'ref_equipment.malus_cat as ref_malus_cat',
      'ref_equipment.min_str as ref_min_str',
      'ref_equipment.capacity as ref_capacity',
      'ref_equipment.waterproof as ref_waterproof',
      'char_inventory.current_ammo',
      'ref_equipment.caliber as ref_caliber',
      'ref_equipment.damage_h as ref_damage_h',
      'ref_equipment.shock as ref_shock',
      'ref_equipment.range as ref_range',
      'ref_equipment.fire_mode as ref_fire_mode',
      'ref_equipment.ammo_count as ref_ammo_count',
    )
    .first()
}

// ─── GET /api/char-sheet/:characterId/inventory ───────────────────────────────
router.get('/:characterId/inventory', async (req, res, next) => {
  try {
    const characterId = req.params.characterId

    const sheet = await db('char_sheet').where({ character_id: characterId }).first()
    if (!sheet) return res.json({ items: [], sols: 0, total_weight: 0, ini_penalty: 0, threshold: 0 })

    const forAttr = await db('char_attributes')
      .where({ char_sheet_id: sheet.id, attr_id: 'FOR' })
      .first()
    const forValue = (forAttr?.base_level ?? 7) + (forAttr?.pc_modifier ?? 0)

    const items = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterId })
      .select(
        'char_inventory.id',
        'char_inventory.equipment_id',
        'char_inventory.container',
        'char_inventory.slot',
        'char_inventory.quantity',
        'char_inventory.custom_name',
        'char_inventory.custom_desc',
        'char_inventory.notes',
        'char_inventory.custom_props',
        'ref_equipment.name as ref_name',
        'ref_equipment.family as ref_family',
        'ref_equipment.category as ref_category',
        'ref_equipment.weight as ref_weight',
        'ref_equipment.location as ref_location',
        'ref_equipment.protection as ref_protection',
        'ref_equipment.protection_shock as ref_protection_shock',
        'ref_equipment.malus_cat as ref_malus_cat',
        'ref_equipment.min_str as ref_min_str',
        'ref_equipment.capacity as ref_capacity',
        'ref_equipment.waterproof as ref_waterproof',
        'char_inventory.current_ammo',
        'ref_equipment.caliber as ref_caliber',
        'ref_equipment.damage_h as ref_damage_h',
        'ref_equipment.shock as ref_shock',
        'ref_equipment.range as ref_range',
        'ref_equipment.fire_mode as ref_fire_mode',
        'ref_equipment.ammo_count as ref_ammo_count',
      )
      .orderBy('char_inventory.created_at', 'asc')

    const totalWeight = items.reduce((sum, item) => {
      if (item.container === 'Coffre') return sum
      if (item.ref_weight == null) return sum
      return sum + item.ref_weight * item.quantity
    }, 0)

    const threshold  = forValue * 3
    const iniPenalty = calcEncumbrancePenalty(totalWeight, forValue)

    res.json({
      items,
      sols:         sheet.sols,
      total_weight: totalWeight,
      ini_penalty:  iniPenalty,
      threshold,
    })
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId/weapon-skill/:weaponInvId ──────────────
// Retourne la compétence associée à une arme + le total de la compétence du personnage.
// Utilisé par CombatModifiersWindow pour afficher "ArmedePoing 12 +3" dans le pill.
router.get('/:characterId/weapon-skill/:weaponInvId', async (req, res, next) => {
  try {
    const { characterId, weaponInvId } = req.params
    const empty = { skillId: null, skillLabel: null, skillTotal: null }

    const weaponItem = await db('char_inventory')
      .where({ id: weaponInvId, character_id: characterId })
      .first()
    if (!weaponItem) return res.json(empty)

    const skillAssoc = await db('ref_equipment_skill_assoc')
      .where({ item_id: weaponItem.equipment_id })
      .first()
    if (!skillAssoc) return res.json(empty)

    const refSkill = await db('ref_skills').where({ id: skillAssoc.skill_id }).first()
    if (!refSkill) return res.json(empty)

    const sheet = await db('char_sheet').where({ character_id: characterId }).first()
    if (!sheet) return res.json(empty)

    const [attrs, charSkill, archetype] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
      db('char_skills').where({ char_sheet_id: sheet.id, skill_id: skillAssoc.skill_id }).first(),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    ])

    const genotypeRow = archetype?.genotype_id
      ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
      : null

    const skillTotal = calcSkillTotal(attrs, charSkill, refSkill, genotypeRow)

    res.json({ skillId: refSkill.id, skillLabel: refSkill.label, skillTotal })
  } catch (err) { next(err) }
})

// ─── PUT /api/char-sheet/:characterId/sols ────────────────────────────────────
// P46 : déclarée AVANT PUT /:characterId/inventory/:itemId
router.put('/:characterId/sols', async (req, res, next) => {
  try {
    const { sols } = req.body
    if (!Number.isInteger(sols) || sols < 0) {
      throw new AppError(400, 'sols doit être un entier non négatif')
    }

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const [updated] = await db('char_sheet')
      .where({ id: sheet.id })
      .update({ sols, updated_at: db.fn.now() })
      .returning('*')

    req.app.get('io').to(req.character.campaign_id).emit(WS.SOLS_UPDATED, {
      characterId: req.params.characterId,
      sols: updated.sols,
    })

    res.json({ sols: updated.sols })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/quick-equip ───────────────────────────
// GM uniquement. Équipement d'urgence pré-combat — bypass isContainerAvailable.
router.post('/:characterId/quick-equip', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'GM uniquement')

    const characterId = req.params.characterId
    const { equipment_id, slot } = req.body

    if (!equipment_id) throw new AppError(400, 'equipment_id requis')
    if (!VALID_SLOTS.includes(slot)) throw new AppError(400, `slot invalide : ${slot}`)

    const conflict = await db('char_inventory')
      .where({ character_id: characterId, slot })
      .first()
    if (conflict) throw new AppError(409, `Slot ${slot} déjà occupé`)

    const [inserted] = await db('char_inventory')
      .insert({ character_id: characterId, equipment_id, container: 'Sac', slot, quantity: 1 })
      .returning('*')

    const item = await getItemWithRef(inserted.id)
    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_ADDED, { characterId, item })

    res.status(201).json({ item })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/inventory ──────────────────────────────
router.post('/:characterId/inventory', async (req, res, next) => {
  try {
    const characterId = req.params.characterId
    const {
      equipment_id,
      container: containerIn,
      slot,
      quantity = 1,
      custom_name, custom_desc, notes,
    } = req.body

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new AppError(400, 'quantity doit être un entier positif')
    }

    let container
    if (containerIn !== undefined) {
      if (!VALID_CONTAINERS.includes(containerIn)) {
        throw new AppError(400, `container invalide : ${containerIn}`)
      }
      if (!(await isContainerAvailable(characterId, containerIn))) {
        throw new AppError(400, `Container "${containerIn}" non disponible`)
      }
      container = containerIn
    } else {
      container = await getDefaultContainer(characterId)
    }

    let resolvedSlot = slot ?? null
    if (resolvedSlot !== null) {
      if (!VALID_SLOTS.includes(resolvedSlot)) {
        throw new AppError(400, `slot invalide : ${resolvedSlot}`)
      }
      const isContainerSlotPost = resolvedSlot === 'D' || resolvedSlot === 'Ce'
      if (isContainerSlotPost) {
        const conflict = await db('char_inventory')
          .where({ character_id: characterId, slot: resolvedSlot })
          .first()
        if (conflict) throw new AppError(409, 'Slot déjà occupé')
      } else if (WEAPON_SLOTS.has(resolvedSlot)) {
        if (!(await isContainerAvailable(characterId, 'Sac'))) {
          throw new AppError(400, 'Sac non disponible — impossible d\'équiper une arme')
        }
        const isTwoHand = resolvedSlot === '2M' || resolvedSlot === 'Tr'
        if (isTwoHand) {
          const conflict = await db('char_inventory')
            .where({ character_id: characterId })
            .whereIn('slot', ['MG', 'MD', '2M', 'Tr'])
            .first()
          if (conflict) throw new AppError(409, 'Mains déjà occupées — impossible d\'équiper une arme à 2 mains')
        } else {
          const conflictTwoHand = await db('char_inventory')
            .where({ character_id: characterId })
            .whereIn('slot', ['2M', 'Tr'])
            .first()
          if (conflictTwoHand) throw new AppError(409, 'Arme à 2 mains déjà équipée — choisissez une seule main')
          const conflict = await db('char_inventory')
            .where({ character_id: characterId, slot: resolvedSlot })
            .first()
          if (conflict) throw new AppError(409, `Slot ${resolvedSlot} déjà occupé`)
        }
        container = 'Sac'
      } else {
        if (!(await isContainerAvailable(characterId, 'Sac'))) {
          throw new AppError(400, 'Sac non disponible — impossible d\'équiper un item')
        }
        const existingAtSlot = await db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where('char_inventory.character_id', characterId)
          .whereRaw("'/' || COALESCE(char_inventory.slot, '') || '/' LIKE ?", [`%/${resolvedSlot}/%`])
          .select('char_inventory.id as id', 'ref_equipment.malus_cat as malus_cat')
        if (existingAtSlot.length >= 3) throw new AppError(409, 'Slot complet — maximum 3 couches')
        const newItemRef = equipment_id
          ? await db('ref_equipment').where({ id: equipment_id }).select('malus_cat').first()
          : null
        const newItemCat = newItemRef?.malus_cat ?? null
        const existingNonS = existingAtSlot.filter(i => i.malus_cat && i.malus_cat !== 'S')
        if (newItemCat && newItemCat !== 'S' && existingNonS.length >= 1) {
          throw new AppError(409, 'Slot déjà occupé par une armure principale (règle 1+S+S)')
        }
        container = 'Sac'
      }
    }

    // Stacking : même equipment_id + même container + slot IS NULL
    if (equipment_id && resolvedSlot === null) {
      const existing = await db('char_inventory')
        .where({ character_id: characterId, equipment_id, container })
        .whereNull('slot')
        .first()
      if (existing) {
        const [updated] = await db('char_inventory')
          .where({ id: existing.id })
          .update({ quantity: existing.quantity + quantity, updated_at: db.fn.now() })
          .returning('*')
        const item = await getItemWithRef(updated.id)
        req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item })
        return res.json({ item })
      }
    }

    const insertData = {
      character_id: characterId,
      equipment_id: equipment_id ?? null,
      container,
      slot: resolvedSlot,
      quantity,
    }
    if (custom_name !== undefined) insertData.custom_name = custom_name
    if (custom_desc !== undefined) insertData.custom_desc = custom_desc
    if (notes      !== undefined) insertData.notes       = notes

    const [inserted] = await db('char_inventory').insert(insertData).returning('*')
    const item = await getItemWithRef(inserted.id)

    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_ADDED, { characterId, item })

    res.status(201).json({ item })
  } catch (err) { next(err) }
})

// ─── PUT /api/char-sheet/:characterId/inventory/:itemId ───────────────────────
router.put('/:characterId/inventory/:itemId', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params

    const existing = await db('char_inventory')
      .where({ id: itemId, character_id: characterId }).first()
    if (!existing) throw new AppError(404, 'Item not found')

    const { container, slot, quantity, custom_name, custom_desc, notes, custom_props, current_ammo } = req.body
    const updates = {}

    if (container    !== undefined) updates.container    = container
    if (slot         !== undefined) updates.slot         = slot
    if (quantity     !== undefined) updates.quantity     = quantity
    if (custom_name  !== undefined) updates.custom_name  = custom_name
    if (custom_desc  !== undefined) updates.custom_desc  = custom_desc
    if (notes        !== undefined) updates.notes        = notes
    if (custom_props !== undefined) updates.custom_props = custom_props
    if (current_ammo !== undefined) updates.current_ammo = current_ammo

    // P13 — guard avant updated_at
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    // Validation slot
    if (updates.slot !== undefined && updates.slot !== null) {
      const isContainerSlotPut = updates.slot === 'D' || updates.slot === 'Ce'
      if (isContainerSlotPut) {
        const conflict = await db('char_inventory')
          .where({ character_id: characterId, slot: updates.slot })
          .whereNot({ id: itemId })
          .first()
        if (conflict) throw new AppError(409, 'Slot déjà occupé')
      } else if (WEAPON_SLOTS.has(updates.slot)) {
        if (!(await isContainerAvailable(characterId, 'Sac'))) {
          throw new AppError(400, 'Sac non disponible — impossible d\'équiper une arme')
        }
        const isTwoHand = updates.slot === '2M' || updates.slot === 'Tr'
        if (isTwoHand) {
          const conflict = await db('char_inventory')
            .where({ character_id: characterId })
            .whereIn('slot', ['MG', 'MD', '2M', 'Tr'])
            .whereNot({ id: itemId })
            .first()
          if (conflict) throw new AppError(409, 'Mains déjà occupées — impossible d\'équiper une arme à 2 mains')
        } else {
          const conflictTwoHand = await db('char_inventory')
            .where({ character_id: characterId })
            .whereIn('slot', ['2M', 'Tr'])
            .whereNot({ id: itemId })
            .first()
          if (conflictTwoHand) throw new AppError(409, 'Arme à 2 mains déjà équipée — choisissez une seule main')
          const conflict = await db('char_inventory')
            .where({ character_id: characterId, slot: updates.slot })
            .whereNot({ id: itemId })
            .first()
          if (conflict) throw new AppError(409, `Slot ${updates.slot} déjà occupé`)
        }
        updates.container = 'Sac'
      } else {
        // Valider que chaque partie est un code armor valide
        const newParts = updates.slot.split('/')
        if (!newParts.every(p => ARMOR_SLOTS.has(p))) {
          throw new AppError(400, `slot invalide : ${updates.slot}`)
        }
        // Codes nouvellement ajoutés (absents du slot actuel de l'item)
        const existingParts = new Set(existing.slot ? existing.slot.split('/') : [])
        const addedCodes = newParts.filter(c => !existingParts.has(c))
        // malus_cat de l'item (commun à tous les slots)
        const newItemCat = existing.equipment_id
          ? (await db('ref_equipment').where({ id: existing.equipment_id }).select('malus_cat').first())?.malus_cat ?? null
          : null
        // 1+S+S : vérifier chaque code nouvellement ajouté
        for (const code of addedCodes) {
          const existingAtSlot = await db('char_inventory')
            .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where('char_inventory.character_id', characterId)
            .whereRaw("'/' || COALESCE(char_inventory.slot, '') || '/' LIKE ?", [`%/${code}/%`])
            .whereNot('char_inventory.id', itemId)
            .select('char_inventory.id as id', 'ref_equipment.malus_cat as malus_cat')
          if (existingAtSlot.length >= 3) {
            throw new AppError(409, `Slot ${code} complet — maximum 3 couches`)
          }
          const existingNonS = existingAtSlot.filter(i => i.malus_cat && i.malus_cat !== 'S')
          if (newItemCat && newItemCat !== 'S' && existingNonS.length >= 1) {
            throw new AppError(409, `Slot ${code} déjà occupé par une armure principale (règle 1+S+S)`)
          }
        }
        // PI2 : Sac obligatoire pour équiper
        if (addedCodes.length > 0 && !(await isContainerAvailable(characterId, 'Sac'))) {
          throw new AppError(400, 'Sac non disponible — impossible d\'équiper un item')
        }
        updates.container = 'Sac'
      }
    }

    // Validation container (si fourni explicitement et pas déjà forcé à 'Sac' par slot)
    if (updates.container !== undefined) {
      if (!VALID_CONTAINERS.includes(updates.container)) {
        throw new AppError(400, `container invalide : ${updates.container}`)
      }
      if (!(await isContainerAvailable(characterId, updates.container))) {
        throw new AppError(400, `Container "${updates.container}" non disponible`)
      }
    }

    if (updates.quantity !== undefined) {
      if (!Number.isInteger(updates.quantity) || updates.quantity < 1) {
        throw new AppError(400, 'quantity doit être un entier positif')
      }
    }

    if (updates.current_ammo != null) {
      const ammo = await db('ref_equipment').where({ id: updates.current_ammo }).first()
      if (!ammo) throw new AppError(404, 'Munition introuvable')
      const weaponRef = existing.equipment_id
        ? await db('ref_equipment').where({ id: existing.equipment_id }).select('caliber', 'family').first()
        : null
      if (!weaponRef || weaponRef.family !== 'Armes')
        throw new AppError(400, 'current_ammo ne peut être défini que sur une arme')
      if (weaponRef.caliber !== ammo.caliber)
        throw new AppError(400, `Munition incompatible — caliber attendu : ${weaponRef.caliber}`)
    }

    // P13 — updated_at APRÈS le guard
    updates.updated_at = db.fn.now()

    await db('char_inventory').where({ id: itemId }).update(updates)
    const item = await getItemWithRef(itemId)

    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item })

    res.json({ item })
  } catch (err) { next(err) }
})

// ─── DELETE /api/char-sheet/:characterId/inventory/:itemId ────────────────────
router.delete('/:characterId/inventory/:itemId', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params

    const existing = await db('char_inventory')
      .where({ id: itemId, character_id: characterId }).first()
    if (!existing) throw new AppError(404, 'Item not found')

    const { quantity: qtyToRemove } = req.body || {}

    if (qtyToRemove !== undefined) {
      if (!Number.isInteger(qtyToRemove) || qtyToRemove < 1) {
        throw new AppError(400, 'quantity doit être un entier positif')
      }
      const newQty = existing.quantity - qtyToRemove
      if (newQty > 0) {
        const [updated] = await db('char_inventory')
          .where({ id: itemId })
          .update({ quantity: newQty, updated_at: db.fn.now() })
          .returning('*')
        req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, {
          characterId, item: updated,
        })
        return res.json({ item: updated })
      }
    }

    await db('char_inventory').where({ id: itemId }).del()

    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_REMOVED, {
      characterId, itemId,
    })

    res.json({ deleted: true, itemId })
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId/macros ──────────────────────────────────
router.get(':characterId/macros', async (req, res, next) => {
  try {
    const macros = await db('character_macros')
      .where({ character_id: req.params.characterId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc')
    res.json({ macros })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/macros ─────────────────────────────────
router.post(':characterId/macros', async (req, res, next) => {
  try {
    const { n } = await db('character_macros')
      .where({ character_id: req.params.characterId })
      .count('id as n').first()
    if (Number(n) >= 10) throw new AppError(400, 'Limite de 10 macros par personnage atteinte')

    const { label, sources, modifier = 0, template } = req.body
    if (!label?.trim()) throw new AppError(400, 'Le nom de la macro est requis')
    if (!Array.isArray(sources) || sources.length === 0) throw new AppError(400, 'Au moins une source requise')
    if (sources.length > 3) throw new AppError(400, 'Maximum 3 sources par macro')

    const VALID_TYPES = new Set(['attribute', 'skill', 'secondary'])
    for (const s of sources) {
      if (!VALID_TYPES.has(s.type)) throw new AppError(400, `Type de source invalide : ${s.type}`)
      if (!s.ref_id)    throw new AppError(400, 'ref_id requis pour chaque source')
      if (!s.ref_label) throw new AppError(400, 'ref_label requis pour chaque source')
    }
    if (modifier < -99 || modifier > 99) throw new AppError(400, 'Modificateur entre −99 et +99')

    const [macro] = await db('character_macros')
      .insert({
        character_id: req.params.characterId,
        label:        label.trim(),
        sources,
        modifier,
        template:     template?.trim() || null,
        sort_order:   Number(n),
      })
      .returning('*')

    res.status(201).json({ macro })
  } catch (err) { next(err) }
})

// ─── PUT /api/char-sheet/:characterId/macros/:macroId ────────────────────────
router.put(':characterId/macros/:macroId', async (req, res, next) => {
  try {
    const macro = await db('character_macros')
      .where({ id: req.params.macroId, character_id: req.params.characterId })
      .first()
    if (!macro) throw new AppError(404, 'Macro introuvable')

    const { label, sources, modifier, template, sort_order } = req.body
    const updates = { updated_at: db.fn.now() }
    if (label      !== undefined) updates.label      = label.trim()
    if (sources    !== undefined) updates.sources    = sources
    if (modifier   !== undefined) updates.modifier   = modifier
    if (template   !== undefined) updates.template   = template?.trim() || null
    if (sort_order !== undefined) updates.sort_order = sort_order

    const [updated] = await db('character_macros')
      .where({ id: req.params.macroId })
      .update(updates)
      .returning('*')

    res.json({ macro: updated })
  } catch (err) { next(err) }
})

// ─── DELETE /api/char-sheet/:characterId/macros/:macroId ─────────────────────
router.delete(':characterId/macros/:macroId', async (req, res, next) => {
  try {
    const macro = await db('character_macros')
      .where({ id: req.params.macroId, character_id: req.params.characterId })
      .first()
    if (!macro) throw new AppError(404, 'Macro introuvable')

    await db('character_macros').where({ id: req.params.macroId }).del()
    res.json({ deleted: true, macroId: req.params.macroId })
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId/macro-options ───────────────────────────
// Données pour le formulaire de création de macro :
// - attributes : liste statique des 8 attributs Polaris
// - skills     : compétences du personnage avec labels (JOIN ref_skills)
// - secondary  : attributs secondaires disponibles
router.get(':characterId/macro-options', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet').where({ character_id: req.params.characterId }).first()

    let skills = []
    if (sheet) {
      skills = await db('char_skills')
        .join('ref_skills', 'char_skills.skill_id', 'ref_skills.id')
        .where({ 'char_skills.char_sheet_id': sheet.id })
        .select('ref_skills.id as skill_id', 'ref_skills.label', 'ref_skills.family')
        .orderBy('ref_skills.family')
        .orderBy('ref_skills.label')
    }

    const attributes = [
      { id: 'FOR', label: 'Force' },
      { id: 'CON', label: 'Constitution' },
      { id: 'COO', label: 'Coordination' },
      { id: 'ADA', label: 'Adaptation' },
      { id: 'PER', label: 'Perception' },
      { id: 'INT', label: 'Intelligence' },
      { id: 'VOL', label: 'Volonté' },
      { id: 'PRE', label: 'Présence' },
    ]

    const secondary = [
      { id: 'rea',                label: 'Réactivité (REA)' },
      { id: 'seuil_etourdi',      label: 'Seuil Étourdissement' },
      { id: 'seuil_incons',       label: 'Seuil Inconscience' },
      { id: 'souffle',            label: 'Souffle' },
      { id: 'resistance_drogues', label: 'Résistance aux drogues' },
    ]

    res.json({ attributes, skills, secondary })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/macro-preview ─────────────────────────
// Calcule le seuil d'une macro en live pour l'aperçu dans le formulaire.
// Body : { sources: [{type, ref_id}], modifier }
// Retourne : { threshold }
router.post(':characterId/macro-preview', async (req, res, next) => {
  try {
    const { sources = [], modifier = 0 } = req.body

    const sheet = await db('char_sheet').where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.json({ threshold: Number(modifier) })

    const [attrs, archetype] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheet.id }),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    ])
    const genotypeRow = archetype?.genotype_id
      ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
      : null

    const na = (attrId) => calcAttributeNA(attrs, attrId, genotypeRow)

    const secondaryValue = (key) => {
      switch (key) {
        case 'rea':                return calcREA(na('ADA'), na('PER'))
        case 'seuil_etourdi':      return calcSeuils(na('FOR'), na('CON'), na('VOL')).etourdissement
        case 'seuil_incons':       return calcSeuils(na('FOR'), na('CON'), na('VOL')).inconscience
        case 'souffle':            return calcSouffle(na('CON'), na('VOL'))
        case 'resistance_drogues': return calcResistanceDroguesInput(na('CON'), na('VOL'))
        default:                   return 0
      }
    }

    let baseThreshold = 0
    for (const src of sources) {
      if (!src.ref_id) continue
      if (src.type === 'attribute') {
        baseThreshold += na(src.ref_id)
      } else if (src.type === 'skill') {
        const [charSkill, refSkill] = await Promise.all([
          db('char_skills').where({ char_sheet_id: sheet.id, skill_id: src.ref_id }).first(),
          db('ref_skills').where({ id: src.ref_id }).first(),
        ])
        baseThreshold += calcSkillTotal(attrs, charSkill, refSkill, genotypeRow)
      } else if (src.type === 'secondary') {
        baseThreshold += secondaryValue(src.ref_id)
      }
    }

    res.json({ threshold: baseThreshold + Number(modifier) })
  } catch (err) { next(err) }
})

export default router
