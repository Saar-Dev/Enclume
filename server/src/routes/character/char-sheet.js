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
import { getCoutAugmentation, getCoutDeblocageX, calcWoundPenalty, calcSkillTotal, calcAttributeNA } from '../../lib/charStats.js'
import {
  calcREA, getAdvantageModForAttr, getAdvantageModForResistance,
  calcSeuils, calcSouffle, calcResistanceDroguesInput, calcResistanceNaturelle,
} from '../../../../shared/polarisUtils.js'
import { resolveWoundInsertion, isShockTestRequired, getWorstWoundSeverity } from '../../lib/woundUtils.js'
import { getAdvantages, addAdvantage, removeAdvantage, getAdvantageNotes, addAdvantageNote, removeAdvantageNote } from '../../services/advantageService.js'
import { getMutations, addMutation, removeMutation, getMutationEffects } from '../../services/mutationService.js'
import { cloneToVault } from '../../services/vaultService.js'
import { getCampaignSettings } from '../../lib/campaignSettingsService.js'
import * as inventoryService from '../../services/inventoryService.js'
import * as modingService from '../../services/modingService.js'
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

    const isOwner = character.user_id && character.user_id === req.user.id
    const isDrone = character.type === 'drone'
    // Drones : tout membre de la campagne peut lire — les routes d'écriture gardent req.isGm
    if (!isOwner && !req.isGm && !isDrone) {
      return next(new AppError(403, 'You do not have permission to access this sheet'))
    }

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

    const [identity, archetype, attributes, skills, settings, mutationEffects] = await Promise.all([
      db('char_identity').where({ char_sheet_id: sheet.id }).first(),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
      db('char_skills').where({ char_sheet_id: sheet.id }).select('*'),
      getCampaignSettings(db, req.character.campaign_id),
      getMutationEffects(sheet.id),
    ])

    res.json({
      sheet,
      identity:   identity   || null,
      archetype:  archetype  || null,
      attributes: attributes || [],
      skills:     skills     || [],
      settings,
      mutationEffects,
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

    // OPT-07 (skill_prerequisites, défaut OFF) : réévalué côté serveur à chaque achat — ne jamais
    // faire confiance à un état déjà chargé côté client (GET /:characterId peut être périmé).
    const settings = await getCampaignSettings(db, req.character.campaign_id)
    if (settings.skill_prerequisites) {
      const skillMinReqs = await db('ref_skill_requirements')
        .where({ skill_id, type: 'SKILL_MIN' })
      if (skillMinReqs.length > 0) {
        const [attrs, archetype, mutationEffects] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
          db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
          getMutationEffects(sheet.id),
        ])
        const genotypeRow = archetype?.genotype_id
          ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
          : null

        for (const req_ of skillMinReqs) {
          const [prereqRefSkill, prereqCharSkill] = await Promise.all([
            db('ref_skills').where({ id: req_.value }).first(),
            db('char_skills').where({ char_sheet_id: sheet.id, skill_id: req_.value }).first(),
          ])
          const total = calcSkillTotal(attrs, prereqCharSkill, prereqRefSkill, genotypeRow, mutationEffects)
          if (total < req_.threshold) {
            throw new AppError(400, `Prérequis non satisfait : ${prereqRefSkill?.label ?? req_.value} ${req_.threshold}+ requis (actuel ${total})`)
          }
        }
      }
    }

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

    const advantages = await getAdvantages(sheet.id)
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

    const { advantage_id } = req.body
    if (!advantage_id) throw new AppError(400, 'advantage_id is required')

    const advantage = await addAdvantage(sheet.id, advantage_id, 'campaign')
    res.status(201).json({ advantage })
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

    const { reason } = req.body
    const advantage = await removeAdvantage(sheet.id, req.params.id, reason)
    res.json({ deleted: true, advantage })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-sheet/:characterId/advantage-notes ─────────────────────────
router.get('/:characterId/advantage-notes', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const notes = await getAdvantageNotes(sheet.id)
    res.json({ notes })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/char-sheet/:characterId/advantage-notes ────────────────────────
router.post('/:characterId/advantage-notes', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const note = await addAdvantageNote(sheet.id, req.body.label)
    res.status(201).json({ note })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/char-sheet/:characterId/advantage-notes/:id ──────────────────
router.delete('/:characterId/advantage-notes/:id', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const result = await removeAdvantageNote(sheet.id, req.params.id)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-sheet/:characterId/mutations ────────────────────────────────
router.get('/:characterId/mutations', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const mutations = await getMutations(sheet.id)
    res.json({ mutations })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-sheet/:characterId/mutation-effects ────────────────────────
// Endpoint léger — uniquement l'agrégat char_mutation_effects_view, pas toute la fiche.
// Utilisé par CharacterSheet.jsx pour rafraîchir naMap après un ajout/retrait de mutation
// depuis AdvantagesPanel (Lot D), sans recharger identity/archetype/attributes/skills.
router.get('/:characterId/mutation-effects', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) return res.json({ mutationEffects: null })

    const mutationEffects = await getMutationEffects(sheet.id)
    res.json({ mutationEffects })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/char-sheet/:characterId/mutations — GM uniquement ──────────────
router.post('/:characterId/mutations', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'GM uniquement')

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { mutation_id, subtype_id } = req.body
    if (!mutation_id) throw new AppError(400, 'mutation_id is required')

    const mutation = await addMutation(sheet.id, mutation_id, subtype_id ?? null)
    res.status(201).json({ mutation })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/char-sheet/:characterId/mutations/:id — GM uniquement ────────
router.delete('/:characterId/mutations/:id', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'GM uniquement')

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const mutation = await removeMutation(sheet.id, req.params.id)
    res.json({ deleted: true, mutation })
  } catch (err) {
    next(err)
  }
})

// ─── Helper blessures ────────────────────────────────────────────────────────

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
    const worst_wound_severity = await getWorstWoundSeverity(db, sheet.id)

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_ADDED, {
      characterId: req.params.characterId,
      wound:       result.wound,
      promoted:    result.promoted,
      shock_test_required,
      worst_wound_severity,
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

    const worst_wound_severity = await getWorstWoundSeverity(db, sheet.id)
    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_UPDATED, {
      characterId: req.params.characterId,
      wound: updated,
      worst_wound_severity,
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

    const worst_wound_severity = await getWorstWoundSeverity(db, sheet.id)
    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_REMOVED, {
      characterId: req.params.characterId,
      woundId: req.params.woundId,
      worst_wound_severity,
    })

    res.json({ deleted: true, woundId: req.params.woundId })
  } catch (err) { next(err) }
})

// ─── Helpers inventaire — voir server/src/services/inventoryService.js ────────
// (extraits Session 141 suite 21, docs/PLAN_MODING.md Étape 0)

// ─── GET /api/char-sheet/:characterId/inventory ───────────────────────────────
router.get('/:characterId/inventory', async (req, res, next) => {
  try {
    const result = await inventoryService.getInventory(req.params.characterId, req.character.campaign_id)
    res.json(result)
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

    const [attrs, charSkill, archetype, mutationEffects] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
      db('char_skills').where({ char_sheet_id: sheet.id, skill_id: skillAssoc.skill_id }).first(),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      getMutationEffects(sheet.id),
    ])

    const genotypeRow = archetype?.genotype_id
      ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
      : null

    const skillTotal = calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects)

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
    const item = await inventoryService.quickEquip(characterId, equipment_id, slot)

    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_ADDED, { characterId, item })

    res.status(201).json({ item })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/inventory ──────────────────────────────
router.post('/:characterId/inventory', async (req, res, next) => {
  try {
    const characterId = req.params.characterId
    const result = await inventoryService.addItem(characterId, req.body)

    if (result.type === 'stack') {
      req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item: result.item })
      return res.json({ item: result.item })
    }
    if (result.type === 'multi') {
      for (const item of result.items) {
        req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_ADDED, { characterId, item })
      }
      return res.status(201).json({ item: result.items[0], items: result.items })
    }

    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_ADDED, { characterId, item: result.item })
    res.status(201).json({ item: result.item })
  } catch (err) { next(err) }
})

// ─── PUT /api/char-sheet/:characterId/inventory/:itemId ───────────────────────
router.put('/:characterId/inventory/:itemId', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params
    const item = await inventoryService.updateItem(characterId, itemId, req.body)

    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item })

    res.json({ item })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/inventory/:itemId/reload ──────────────
// Recharge une arme : définit current_ammo + ammo_remaining, décrémente l'inventaire munitions.
// Body : { ammo_item_id: uuid }  ← char_inventory.id de la munition à charger
router.post('/:characterId/inventory/:itemId/reload', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params
    const { ammo_item_id } = req.body
    const result = await inventoryService.reloadWeapon(characterId, itemId, ammo_item_id)

    if (result.ammoRemoved) {
      req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_REMOVED, { characterId, itemId: result.ammoItemId })
    } else {
      req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item: result.ammoItem })
    }
    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item: result.weapon })
    res.json({ item: result.weapon })
  } catch (err) { next(err) }
})

// ─── DELETE /api/char-sheet/:characterId/inventory/:itemId ────────────────────
router.delete('/:characterId/inventory/:itemId', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params
    const { quantity: qtyToRemove } = req.body || {}
    const result = await inventoryService.removeItem(characterId, itemId, qtyToRemove)

    if (result.deleted) {
      req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_REMOVED, { characterId, itemId })
      return res.json({ deleted: true, itemId })
    }
    req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item: result.item })
    res.json({ item: result.item })
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId/moding/state ─────────────────────────────
// docs/PLAN_MODING.md Phase A — armes du personnage (avec mods installés) + mods installables.
router.get('/:characterId/moding/state', async (req, res, next) => {
  try {
    const state = await modingService.getModingState(req.params.characterId)
    res.json(state)
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/moding/install ──────────────────────────
// body: { weaponInvId, modInvId }
router.post('/:characterId/moding/install', async (req, res, next) => {
  try {
    const { characterId } = req.params
    const { weaponInvId, modInvId } = req.body
    const { removeResult, state } = await modingService.installMod(characterId, weaponInvId, modInvId)

    if (removeResult.deleted) {
      req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_REMOVED, { characterId, itemId: modInvId })
    } else {
      req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, { characterId, item: removeResult.item })
    }
    req.app.get('io').to(req.character.campaign_id).emit(WS.MOD_INSTALLED, {
      characterId, weaponInvId, mods: state.weapons.find(w => w.id === weaponInvId)?.installed_mods,
    })

    res.json(state)
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId/macros ──────────────────────────────────
router.get('/:characterId/macros', async (req, res, next) => {
  try {
    const macros = await db('character_macros')
      .where({ character_id: req.params.characterId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc')
    res.json({ macros })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/macros ─────────────────────────────────
router.post('/:characterId/macros', async (req, res, next) => {
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
router.put('/:characterId/macros/:macroId', async (req, res, next) => {
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
router.delete('/:characterId/macros/:macroId', async (req, res, next) => {
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
router.get('/:characterId/macro-options', async (req, res, next) => {
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
      { id: 'resistance_drogues',   label: 'Résistance aux drogues' },
      { id: 'resistance_poison',    label: 'Résistance aux poisons' },
      { id: 'resistance_maladie',   label: 'Résistance aux maladies' },
      { id: 'resistance_radiation', label: 'Résistance aux radiations' },
    ]

    res.json({ attributes, skills, secondary })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/macro-preview ─────────────────────────
// Calcule le seuil d'une macro en live pour l'aperçu dans le formulaire.
// Body : { sources: [{type, ref_id}], modifier }
// Retourne : { threshold }
router.post('/:characterId/macro-preview', async (req, res, next) => {
  try {
    const { sources = [], modifier = 0 } = req.body

    const sheet = await db('char_sheet').where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.json({ threshold: Number(modifier) })

    const [attrs, archetype, mutationEffects, advantages] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheet.id }),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      getMutationEffects(sheet.id),
      getAdvantages(sheet.id),
    ])
    const genotypeRow = archetype?.genotype_id
      ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
      : null

    const na = (attrId) => calcAttributeNA(attrs, attrId, genotypeRow, mutationEffects)

    const secondaryValue = (key) => {
      switch (key) {
        case 'rea':                return calcREA(na('ADA'), na('PER'), getAdvantageModForAttr(advantages, 'reaction'))
        case 'seuil_etourdi':      return calcSeuils(na('FOR'), na('CON'), na('VOL')).etourdissement
        case 'seuil_incons':       return calcSeuils(na('FOR'), na('CON'), na('VOL')).inconscience
        case 'souffle':            return calcSouffle(na('CON'), na('VOL'), getAdvantageModForAttr(advantages, 'breath'))
        case 'resistance_drogues':   return calcResistanceNaturelle(calcResistanceDroguesInput(na('CON'), na('VOL'))) + (mutationEffects?.mod_res_drugs ?? 0) + getAdvantageModForResistance(advantages, 'drugs')
        case 'resistance_poison':    return calcResistanceNaturelle(na('CON')) + (mutationEffects?.mod_res_poison ?? 0) + getAdvantageModForResistance(advantages, 'poison')
        case 'resistance_maladie':   return calcResistanceNaturelle(na('CON')) + (mutationEffects?.mod_res_disease ?? 0) + getAdvantageModForResistance(advantages, 'disease')
        case 'resistance_radiation': return calcResistanceNaturelle(na('CON')) + (mutationEffects?.mod_res_radiation ?? 0) + getAdvantageModForResistance(advantages, 'radiation')
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
        baseThreshold += calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects)
      } else if (src.type === 'secondary') {
        baseThreshold += secondaryValue(src.ref_id)
      }
    }

    res.json({ threshold: baseThreshold + Number(modifier) })
  } catch (err) { next(err) }
})

// ─── Routes drone ─────────────────────────────────────────────────────────────
// Ownership : router.param laisse passer tous les membres pour les drones (isDrone bypass).
// Lectures : ouvertes à tous les membres.
// Écritures : req.isGm obligatoire, sauf PUT /drone/weapons/:id (GM ou owner).

// Même logique que resolveAmmoInit mais sans paramètre slot (drones n'ont pas de slots)
async function resolveDroneAmmoInit(equipmentId) {
  if (!equipmentId) return null
  const ref = await db('ref_equipment')
    .where({ id: equipmentId })
    .select('caliber', 'ammo_count')
    .first()
  if (!ref?.caliber || !ref?.ammo_count) return null
  const m = String(ref.ammo_count).match(/\d+/)
  const n = m ? parseInt(m[0], 10) : 0
  return n > 0 ? n : null
}

// Helper — GM ou propriétaire du drone (pattern ABAC : rôle + attribut propriété)
const droneIsGmOrOwner = req =>
  req.isGm || !!(req.character.user_id && req.character.user_id === req.user.id)

// GET /:characterId/drone — fiche + programmes (JOIN ref_equipment pour name/description tooltip)
router.get('/:characterId/drone', async (req, res, next) => {
  try {
    const drone = await db('drone_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!drone) return res.json({ drone: null })

    const programs = await db('drone_programs')
      .where({ 'drone_programs.character_id': req.params.characterId })
      .leftJoin('ref_equipment', 'drone_programs.equipment_id', 'ref_equipment.id')
      .select(
        'drone_programs.id',
        'drone_programs.character_id',
        'drone_programs.equipment_id',
        'drone_programs.label_override',
        'drone_programs.category',
        'drone_programs.level',
        'drone_programs.sort_order',
        'ref_equipment.name as program_name',
        'ref_equipment.description as program_description',
      )
      .orderBy('drone_programs.sort_order', 'asc')
      .orderBy('drone_programs.id', 'asc')

    res.json({ drone, programs })
  } catch (err) { next(err) }
})

// PUT /:characterId/drone — mise à jour stats descriptives (GM uniquement)
// localisation_ref exclu intentionnellement : changer sa valeur invaliderait damages
router.put('/:characterId/drone', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const {
      taille, poids, vitesse, nt,
      source_energie, autonomie, mode_deplacement, profondeur_max, disponibilite,
      blindage, blindage_iem, armure_materiau,
      ordinateur_gen, ordinateur_nt,
      echelle, integrite_max, equip_special, notes_gm,
      charge_utile,
    } = req.body

    const updates = {
      taille, poids, vitesse, nt,
      source_energie, autonomie, mode_deplacement, profondeur_max, disponibilite,
      blindage, blindage_iem, armure_materiau,
      ordinateur_gen, ordinateur_nt,
      echelle, integrite_max, equip_special, notes_gm,
      charge_utile,
    }
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k])
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const [drone] = await db('drone_sheet')
      .where({ character_id: req.params.characterId })
      .update(updates)
      .returning('*')

    res.json({ drone })
  } catch (err) { next(err) }
})

// GET /:characterId/drone/cargo — items transférés dans le drone (char_inventory, container Coffre)
// Lecture ouverte à tous les membres (même règle que les autres GET drone).
router.get('/:characterId/drone/cargo', async (req, res, next) => {
  try {
    const items = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': req.params.characterId })
      .select(
        'char_inventory.id',
        'char_inventory.equipment_id',
        'char_inventory.quantity',
        'char_inventory.custom_name',
        'ref_equipment.name as ref_name',
        'ref_equipment.family as ref_family',
        'ref_equipment.weight as ref_weight',
      )
      .orderBy('char_inventory.created_at', 'asc')

    const total_weight = items.reduce((sum, item) =>
      sum + (item.ref_weight ?? 0) * (item.quantity ?? 1), 0)

    res.json({ items, total_weight })
  } catch (err) { next(err) }
})

// POST /:characterId/drone/cargo/:invId/drop — retourne un item vers le sac du propriétaire
// Auth : GM ou propriétaire du drone (user_id).
router.post('/:characterId/drone/cargo/:invId/drop', async (req, res, next) => {
  try {
    const drone = req.character
    if (!req.isGm && (drone.user_id == null || drone.user_id !== req.user.id)) {
      throw new AppError(403, 'Seul le propriétaire ou le GM peut larguer des items')
    }
    if (drone.user_id == null) {
      throw new AppError(400, "Ce drone n'a pas de propriétaire — impossible de larguer")
    }

    const ownerChar = await db('characters')
      .where({ campaign_id: drone.campaign_id, user_id: drone.user_id, type: 'pj' })
      .select('id')
      .first()
    if (!ownerChar) throw new AppError(404, 'Personnage propriétaire introuvable')

    const container = await inventoryService.getDefaultContainer(ownerChar.id)

    const updated = await db('char_inventory')
      .where({ id: req.params.invId, character_id: drone.id })
      .update({ character_id: ownerChar.id, container, slot: null })
    if (!updated) throw new AppError(404, 'Item introuvable dans le cargo')

    res.json({ ok: true })
  } catch (err) { next(err) }
})

// PUT /:characterId/drone/integrity — intégrité actuelle + cases dommages (GM uniquement)
router.put('/:characterId/drone/integrity', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const { integrite_actuelle, damages } = req.body
    const updates = {}
    if (integrite_actuelle !== undefined) updates.integrite_actuelle = integrite_actuelle
    if (damages            !== undefined) updates.damages = JSON.stringify(damages)
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const [drone] = await db('drone_sheet')
      .where({ character_id: req.params.characterId })
      .update(updates)
      .returning('*')

    res.json({ drone })
  } catch (err) { next(err) }
})

// POST /:characterId/drone/programs — ajouter un programme (GM uniquement)
// Catalogue : equipment_id → catégorie lue depuis ref_equipment (jamais confiance au client)
// Custom    : label_override + category obligatoires
// Validation contrainte ordinateur si ordinateur_gen/nt définis
router.post('/:characterId/drone/programs', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const { equipment_id, label_override, level, sort_order = 0 } = req.body
    if (!equipment_id && !label_override) throw new AppError(400, 'equipment_id ou label_override requis')
    if (level === undefined || level === null) throw new AppError(400, 'level is required')
    if (level < 0 || level > 30) throw new AppError(400, 'level must be between 0 and 30')

    // Déterminer la catégorie
    let category
    if (equipment_id) {
      const ref = await db('ref_equipment').where({ id: equipment_id }).select('category').first()
      if (!ref) throw new AppError(404, 'Programme introuvable dans le catalogue')
      category = ref.category
    } else {
      category = req.body.category
      if (!category) throw new AppError(400, 'category requis pour un programme custom')
    }

    // Validation contrainte ordinateur (si configuré)
    const droneSheet = await db('drone_sheet')
      .where({ character_id: req.params.characterId })
      .select('ordinateur_gen', 'ordinateur_nt')
      .first()
    if (droneSheet?.ordinateur_gen != null && droneSheet?.ordinateur_nt != null) {
      const niveauMax = droneSheet.ordinateur_gen + 2 * droneSheet.ordinateur_nt
      if (level > niveauMax) throw new AppError(400, `Niveau max pour cet ordinateur : ${niveauMax}`)
      const potentiel = 10 + (droneSheet.ordinateur_gen * droneSheet.ordinateur_nt) * 2
      const row = await db('drone_programs')
        .where({ character_id: req.params.characterId })
        .sum('level as total')
        .first()
      if ((Number(row.total) || 0) + level > potentiel) {
        throw new AppError(400, `Potentiel total dépassé (max : ${potentiel})`)
      }
    }

    const [program] = await db('drone_programs')
      .insert({
        character_id: req.params.characterId,
        equipment_id: equipment_id || null,
        label_override: label_override || null,
        category,
        level,
        sort_order,
      })
      .returning('*')

    // Enrichir avec name/description pour le client
    const enriched = { ...program }
    if (equipment_id) {
      const ref = await db('ref_equipment').where({ id: equipment_id }).select('name', 'description').first()
      enriched.program_name = ref?.name ?? null
      enriched.program_description = ref?.description ?? null
    }

    res.status(201).json({ program: enriched })
  } catch (err) { next(err) }
})

// PUT /:characterId/drone/programs/:programId — modifier un programme (GM uniquement)
// Seuls level et sort_order sont modifiables après création.
// equipment_id / label_override / category sont immuables.
router.put('/:characterId/drone/programs/:programId', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const { level, sort_order } = req.body
    const updates = {}
    if (level !== undefined) {
      if (level < 0 || level > 30) throw new AppError(400, 'level must be between 0 and 30')
      updates.level = level
    }
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const program = await db('drone_programs')
      .where({ id: req.params.programId, character_id: req.params.characterId })
      .first()
    if (!program) throw new AppError(404, 'Program not found')

    const [updated] = await db('drone_programs')
      .where({ id: req.params.programId })
      .update(updates)
      .returning('*')

    // Enrichir avec name/description pour le client
    const enriched = { ...updated }
    if (updated.equipment_id) {
      const ref = await db('ref_equipment').where({ id: updated.equipment_id }).select('name', 'description').first()
      enriched.program_name = ref?.name ?? null
      enriched.program_description = ref?.description ?? null
    }

    res.json({ program: enriched })
  } catch (err) { next(err) }
})

// DELETE /:characterId/drone/programs/:programId — supprimer un programme (GM uniquement)
router.delete('/:characterId/drone/programs/:programId', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const deleted = await db('drone_programs')
      .where({ id: req.params.programId, character_id: req.params.characterId })
      .delete()
    if (!deleted) throw new AppError(404, 'Program not found')

    res.json({ message: 'Program deleted' })
  } catch (err) { next(err) }
})

// GET /:characterId/drone/weapons — liste armes avec stats ref_equipment
router.get('/:characterId/drone/weapons', async (req, res, next) => {
  try {
    const weapons = await db('drone_weapons')
      .where({ 'drone_weapons.character_id': req.params.characterId })
      .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
      .select(
        'drone_weapons.id',
        'drone_weapons.character_id',
        'drone_weapons.equipment_id',
        'drone_weapons.contenance_chargeur',
        'drone_weapons.ammo_restant',
        'drone_weapons.sort_order',
        'drone_weapons.label_override',
        'drone_weapons.name',
        'drone_weapons.damage_formula',
        'drone_weapons.portee',
        'drone_weapons.fire_mode',
        'drone_weapons.notes',
        db.raw(`COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name) as display_name`),
        'ref_equipment.name as ref_name',
        'ref_equipment.damage_h as ref_damage_h',
        'ref_equipment.shock as ref_shock',
        'ref_equipment.range as ref_range',
        'ref_equipment.fire_mode as ref_fire_mode',
        'ref_equipment.caliber as ref_caliber',
        'ref_equipment.ammo_count as ref_ammo_count',
      )
      .orderBy('drone_weapons.sort_order', 'asc')
      .orderBy('drone_weapons.id', 'asc')

    res.json({ weapons })
  } catch (err) { next(err) }
})

// POST /:characterId/drone/weapons — ajouter une arme (GM uniquement)
router.post('/:characterId/drone/weapons', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const {
      equipment_id, contenance_chargeur = 0, label_override, sort_order = 0,
      name, damage_formula, portee, fire_mode, notes,
    } = req.body

    // Arme catalogue OU arme custom (name + damage_formula obligatoires si pas de catalogue)
    if (!equipment_id && (!name || !damage_formula)) {
      throw new AppError(400, 'equipment_id or (name + damage_formula) required')
    }

    let refEquipment = null
    if (equipment_id) {
      refEquipment = await db('ref_equipment')
        .where({ id: equipment_id, family: 'Armes' })
        .first()
      if (!refEquipment) throw new AppError(400, 'Equipment not found or not a weapon')
    }

    const autoAmmo = equipment_id ? await resolveDroneAmmoInit(equipment_id) : null

    const insertData = {
      character_id: req.params.characterId,
      equipment_id: equipment_id ?? null,
      contenance_chargeur,
      sort_order,
    }
    if (label_override)   insertData.label_override   = label_override
    if (name)             insertData.name             = name
    if (damage_formula)   insertData.damage_formula   = damage_formula
    if (portee)           insertData.portee           = portee
    // fire_mode : explicite → ref_equipment.fire_mode (armes catalogue) → null (custom sans mode)
    if (fire_mode)        insertData.fire_mode        = fire_mode
    else if (refEquipment?.fire_mode) insertData.fire_mode = refEquipment.fire_mode.toLowerCase()
    if (notes)            insertData.notes            = notes
    if (autoAmmo !== null) insertData.ammo_restant    = autoAmmo

    const [weapon] = await db('drone_weapons').insert(insertData).returning('*')

    const weaponWithRef = await db('drone_weapons')
      .where({ 'drone_weapons.id': weapon.id })
      .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
      .select(
        'drone_weapons.*',
        db.raw(`COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name) as display_name`),
        'ref_equipment.name as ref_name',
        'ref_equipment.damage_h as ref_damage_h',
        'ref_equipment.shock as ref_shock',
        'ref_equipment.range as ref_range',
        'ref_equipment.fire_mode as ref_fire_mode',
        'ref_equipment.caliber as ref_caliber',
        'ref_equipment.ammo_count as ref_ammo_count',
      )
      .first()

    res.status(201).json({ weapon: weaponWithRef })
  } catch (err) { next(err) }
})

// PUT /:characterId/drone/weapons/:weaponId — modifier arme (GM ou owner)
// Champs éditables : contenance_chargeur, ammo_restant, label_override, sort_order
router.put('/:characterId/drone/weapons/:weaponId', async (req, res, next) => {
  try {
    const isOwner = req.character.user_id && req.character.user_id === req.user.id
    if (!req.isGm && !isOwner) throw new AppError(403, 'GM or owner required')

    const { contenance_chargeur, ammo_restant, label_override, sort_order, fire_mode } = req.body
    const updates = {}
    if (contenance_chargeur !== undefined) updates.contenance_chargeur = contenance_chargeur
    if (ammo_restant        !== undefined) updates.ammo_restant        = ammo_restant
    if (label_override      !== undefined) updates.label_override      = label_override
    if (sort_order          !== undefined) updates.sort_order          = sort_order
    if (fire_mode           !== undefined) updates.fire_mode           = fire_mode
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const existing = await db('drone_weapons')
      .where({ id: req.params.weaponId, character_id: req.params.characterId })
      .first()
    if (!existing) throw new AppError(404, 'Weapon not found')

    await db('drone_weapons').where({ id: req.params.weaponId }).update(updates)

    const weapon = await db('drone_weapons')
      .where({ 'drone_weapons.id': req.params.weaponId })
      .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
      .select(
        'drone_weapons.*',
        db.raw(`COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name) as display_name`),
        'ref_equipment.name as ref_name',
        'ref_equipment.damage_h as ref_damage_h',
        'ref_equipment.shock as ref_shock',
        'ref_equipment.range as ref_range',
        'ref_equipment.fire_mode as ref_fire_mode',
        'ref_equipment.caliber as ref_caliber',
        'ref_equipment.ammo_count as ref_ammo_count',
      )
      .first()

    res.json({ weapon })
  } catch (err) { next(err) }
})

// DELETE /:characterId/drone/weapons/:weaponId — supprimer arme (GM uniquement)
router.delete('/:characterId/drone/weapons/:weaponId', async (req, res, next) => {
  try {
    if (!droneIsGmOrOwner(req)) throw new AppError(403, 'GM or owner required')

    const deleted = await db('drone_weapons')
      .where({ id: req.params.weaponId, character_id: req.params.characterId })
      .delete()
    if (!deleted) throw new AppError(404, 'Weapon not found')

    res.json({ message: 'Weapon deleted' })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/clone-to-vault ───────────────────────
// PLAN_VAULT.md Étape 4 — transfert libre "vers le Vault" (Décision 3). Réutilise le
// router.param('characterId') existant (ownership OU GM, via campaign_members) pour l'accès à la
// route, mais cloneToVault() applique sa propre règle plus stricte (propriétaire uniquement, pas
// GM) — un MJ qui consulte la fiche d'un joueur ne doit pas pouvoir la faire atterrir dans SON
// propre Vault. Rejette aussi un personnage non finalisé (Piège P6) et les drones/pnj hors scope
// pour cette route précise ne sont pas bloqués ici : cloneToVault gère tous les types via le
// registre, un MJ pourrait vouloir vaulter "son" drone s'il en est owner (rare mais cohérent).
router.post('/:characterId/clone-to-vault', async (req, res, next) => {
  try {
    const character = await cloneToVault(req.character.id, req.user.id)
    res.status(201).json({ character })
  } catch (err) { next(err) }
})

export default router
