/**
 * char-sheet.js — Routes fiche personnage Polaris
 *
 * Monté sous /api/char-sheet dans index.js.
 *
 * Ownership : router.use(requireAuth) + router.param('characterId', ...) assurent
 * auth + ownership (owner OU GM) avant chaque handler. req.character, req.isGm et
 * req.isVaultOwner sont disponibles dans toutes les routes /:characterId.
 *
 * req.isVaultOwner (personnage Coffre, campaign_id NULL — propriétaire déjà vérifié par
 * router.param) : le propriétaire d'un personnage du Coffre a les mêmes pouvoirs qu'un MJ sur SA
 * PROPRE fiche — le Coffre est un espace personnel, aucun contrôle interne de plausibilité/coût,
 * le MJ de la campagne cible juge à l'approbation du transfert (docs/EN_COURS.md, décision Saar
 * 2026-08-16). Ne JAMAIS l'utiliser comme substitut de `req.isGm` sur une route qui n'a de sens
 * qu'en session réelle (fatigue, quick-equip, validation de jauge) — seules les routes de
 * CONSTRUCTION (attributs, compétences, XP, sols, mutations, avantages) l'acceptent.
 *
 * Routes :
 *   GET    /api/char-sheet/:characterId              — fiche complète (toutes tables)
 *   POST   /api/char-sheet/:characterId              — crée une fiche vide
 *   PUT    /api/char-sheet/:characterId/identity     — sauvegarde identité
 *   PUT    /api/char-sheet/:characterId/archetype    — sauvegarde archétype
 *   PUT    /api/char-sheet/:characterId/attributes   — sauvegarde attributs (bulk upsert, GM uniquement)
 *   POST   /api/char-sheet/:characterId/attributes/buy — dépense 5 XP pour +1 modificateur PC (plafond 5)
 *   PUT    /api/char-sheet/:characterId/skills                      — sauvegarde compétences (bulk upsert)
 *   PUT    /api/char-sheet/:characterId/skills/toggle-learned      — toggle is_learned pouvoir Polaris (owner ou GM)
 *   PUT    /api/char-sheet/:characterId/chc          — sauvegarde Chance
 *   PUT    /api/char-sheet/:characterId/xp           — modifie solde XP (GM uniquement)
 *   POST   /api/char-sheet/:characterId/skills/buy   — dépense XP pour augmenter une compétence
 *   GET    /api/char-sheet/:characterId/advantages   — liste avantages/désavantages
 *   POST   /api/char-sheet/:characterId/advantages   — octroie un avantage/désavantage (GM uniquement, narratif, sans coût PC)
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
import { getCoutAugmentation, getCoutDeblocageX, getCoutAttributPc, MAX_PC_MODIFIER, calcWoundPenalty, calcSkillTotal, calcAttributeNA } from '../../lib/charStats.js'
import { calcActiveMalus } from '../../lib/activeMalusRegistry.js'
import { resolveFatigueTest, restFatigue } from '../../lib/fatigueService.js'
import {
  calcREA, getAdvantageModForAttr, getAdvantageModForResistance, getMutationModForResistance,
  calcSeuils, calcSouffle, calcResistanceDroguesInput, calcResistanceNaturelle, calcResistanceDommages,
  getNaturalArmorMod,
} from '../../../../shared/polarisUtils.js'
import { areRequirementsSatisfied } from '../../../../shared/skillRequirements.js'
import { getWorstWoundSeverity } from '../../lib/woundUtils.js'
import { applyWound } from '../../lib/woundService.js'
import { getAdvantages, grantAdvantage, removeAdvantage, getAdvantageNotes, addAdvantageNote, removeAdvantageNote } from '../../services/advantageService.js'
import { getMutations, addMutation, removeMutation, getMutationEffects } from '../../services/mutationService.js'
import { cloneToVault } from '../../services/vaultService.js'
import { createEmptySheet } from '../../services/charSheetService.js'
import { getCampaignSettings } from '../../lib/campaignSettingsService.js'
import { isExoActorAuthorized } from '../../lib/combatantContextService.js'
import { applyExoAvarie, removeExoAvarie } from '../../lib/exoAvarieService.js'
import { applyExoTemplate } from '../../lib/exoTemplateService.js'
import { getCharacterMovementBudget } from '../../services/movementBudgetService.js'
import {
  EXO_AVARIE_SEVERITY_ORDER, EXO_CATEGORY_ORDER, EXO_ENVIRONMENT_VALUES, EXO_MOVEMENT_MODE_VALUES,
  EXO_COMPUTER_ROLE_VALUES,
} from '../../../../shared/exoConstants.js'
import { computeOrdinateurStats } from '../../../../shared/computerStats.js'
import * as inventoryService from '../../services/inventoryService.js'
import * as modingService from '../../services/modingService.js'
import { WS } from '../../../../shared/events.js'
import {
  WOUND_LOCATIONS, WOUND_SEVERITIES, isTestBlockingWound,
} from '../../../../shared/woundConstants.js'

const router = Router()

// ─── Auth + Ownership automatique sur toutes les routes /:characterId ──────────
router.use(requireAuth)

router.param('characterId', async (req, res, next, characterId) => {
  try {
    const character = await db('characters').where({ id: characterId }).first()
    if (!character) return next(new AppError(404, 'Character not found'))

    // Personnage Coffre-native (campaign_id NULL, vault_id posé) : pas de campaign_members à lire,
    // accès réservé au seul propriétaire (ownership). Ancien gel sur wizard_locked_at retiré
    // (docs/EN_COURS.md, 2026-08-16) : le Coffre est désormais un espace personnel librement
    // éditable par son propriétaire, sans limite de temps ni de statut Wizard — le contrôle se fait
    // à la frontière (approbation MJ au transfert vers une campagne, vaultService.js), jamais ici.
    if (character.campaign_id == null) {
      if (character.user_id !== req.user.id) return next(new AppError(403, 'You do not have permission to access this sheet'))

      req.character = character
      req.isGm = false
      req.isVaultOwner = true
      return next()
    }

    const member = await db('campaign_members')
      .where({ campaign_id: character.campaign_id, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, 'You are not a member of this campaign'))

    req.character = character
    req.isGm     = member.role === 'gm'
    req.isVaultOwner = false

    const isOwner = character.user_id && character.user_id === req.user.id
    const isDrone = character.type === 'drone'
    const isExo = character.type === 'exo'
    // Drones/exo-armures : tout membre de la campagne peut lire — les routes d'écriture gardent
    // req.isGm (drone) ou exoIsGmOrOwnerOrPilot (exo, résolution async du pilote lié — un pilote
    // sans lien de propriété doit pouvoir lire la fiche qu'il pilote, cf. PLAN_EXOARMURE.md §6.3).
    if (!isOwner && !req.isGm && !isDrone && !isExo) {
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
      return res.json({ character: req.character, sheet: null })
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
      character:  req.character,
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
// Filet de sécurité pour les personnages orphelins (créés avant que characters.js
// ne crée la fiche de façon atomique — voir POST /campaigns/:campaignId/characters).
// Idempotente : si la fiche existe déjà (pré-check ou course concurrente détectée par
// la contrainte unique), la renvoie telle quelle au lieu d'échouer. Un personnage neuf
// créé via characters.js a déjà sa fiche et ne passe jamais par cette route.
router.post('/:characterId', async (req, res, next) => {
  try {
    const existing = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (existing) return res.status(200).json({ sheet: existing })

    let result
    try {
      result = await db.transaction((trx) => createEmptySheet(trx, req.params.characterId))
    } catch (err) {
      // 23505 = violation de la contrainte uq_char_sheet_character_id : une autre requête
      // concurrente (ex. double-effet React StrictMode) a créé la fiche entre le pré-check
      // et cet insert — reproduit et confirmé en base réelle (Session 143). La fiche existe,
      // ce n'est pas un échec pour l'appelant.
      if (err.code === '23505') {
        const sheet = await db('char_sheet').where({ character_id: req.params.characterId }).first()
        return res.status(200).json({ sheet })
      }
      throw err
    }

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
// GM uniquement — le niveau de base et le modificateur PC sont hors contrôle joueur.
router.put('/:characterId/attributes', async (req, res, next) => {
  try {
    if (!req.isGm && !req.isVaultOwner) throw new AppError(403, 'Only the GM can modify attributes')

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

// ─── POST /api/char-sheet/:characterId/attributes/buy ────────────────────────
// Dépense 5 XP pour augmenter le modificateur PC d'un attribut de +1 (plafond
// MAX_PC_MODIFIER). Le GM édite librement pc_modifier via PUT /attributes,
// sans coût — cette route est le chemin joueur (Mode Progression).
router.post('/:characterId/attributes/buy', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { attr_id } = req.body
    const VALID_ATTRS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']
    if (!VALID_ATTRS.includes(attr_id)) {
      throw new AppError(400, `Invalid attr_id: ${attr_id}`)
    }

    const attrRow = await db('char_attributes')
      .where({ char_sheet_id: sheet.id, attr_id })
      .first()
    const currentPc = attrRow?.pc_modifier ?? 0

    if (currentPc >= MAX_PC_MODIFIER) {
      throw new AppError(400, `Modificateur PC déjà au maximum (${MAX_PC_MODIFIER})`)
    }

    const cout = getCoutAttributPc()
    if (sheet.xp_available < cout) {
      throw new AppError(400, `XP insuffisants : ${sheet.xp_available} disponibles, ${cout} requis`)
    }

    const newPc = currentPc + 1

    await db.transaction(async (trx) => {
      await trx('char_attributes')
        .insert({
          char_sheet_id: sheet.id,
          attr_id,
          base_level:    attrRow?.base_level ?? 7,
          pc_modifier:   newPc,
        })
        .onConflict(['char_sheet_id', 'attr_id'])
        .merge(['pc_modifier'])

      await trx('char_sheet')
        .where({ id: sheet.id })
        .update({
          xp_available: sheet.xp_available - cout,
          updated_at:   trx.fn.now(),
        })
    })

    res.json({
      attr_id,
      pc_modifier:  newPc,
      xp_available: sheet.xp_available - cout,
      cout,
    })
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
    if (!req.isGm && !req.isVaultOwner) throw new AppError(403, 'Only the GM can modify skills directly')

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
    if (!req.isGm && !req.isVaultOwner) throw new AppError(403, 'Only the GM can modify XP')

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
// ou débloquer une compétence (X) (coût 1 PE, mastery → -3, is_learned → true).
//
// Logique :
//   1. Charger char_skills pour ce skill_id (mastery, is_learned)
//   2. Charger ref_skills pour ce skill_id (marker)
//   3. Si marker='(X)' et is_learned=false → coût 1 PE, mastery → -3, is_learned → true
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

    // MUTATION/ADVANTAGE/GENOTYPE : toujours revalidés côté serveur, jamais gatés par une option de
    // campagne (contrairement à SKILL_MIN ci-dessus) — cf. docs/PLAN_MUTATION2.md Lot 5 [CS7]. Le
    // client (SkillsPanel.jsx) masque déjà le bouton d'achat si le prérequis n'est pas satisfait ;
    // cette revalidation empêche un achat via une requête forgée qui contournerait l'UI.
    // areRequirementsSatisfied (shared/skillRequirements.js) : même évaluateur ET/OU que le client
    // (or_group — ex. HYBRIDE : génotype hybride OU mutation Amphibie).
    const identityReqs = await db('ref_skill_requirements')
      .whereIn('type', ['MUTATION', 'ADVANTAGE', 'GENOTYPE'])
      .where({ skill_id })
    if (identityReqs.length > 0) {
      const [activeMutationIds, activeAdvantageIds, archetype] = await Promise.all([
        db('char_mutations').where({ char_sheet_id: sheet.id, status: 'active' }).pluck('mutation_id'),
        db('char_advantages').where({ char_sheet_id: sheet.id }).whereNull('removed_at').pluck('advantage_id'),
        db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      ])
      const mutationSet = new Set(activeMutationIds.map(String))
      const advantageSet = new Set(activeAdvantageIds)
      const genotypeId = archetype?.genotype_id ?? null

      const satisfied = areRequirementsSatisfied(identityReqs, (req_) => {
        if (req_.type === 'MUTATION') return mutationSet.has(req_.value)
        if (req_.type === 'ADVANTAGE') return advantageSet.has(req_.value)
        if (req_.type === 'GENOTYPE') return genotypeId === req_.value
        return true
      })
      if (!satisfied) {
        throw new AppError(400, 'Prérequis non satisfait : mutation/avantage/génotype requis')
      }
    }

    let cout
    let newMastery   = currentMastery
    let newIsLearned = currentLearned

    if (isXReserved && !currentLearned) {
      cout         = getCoutDeblocageX()
      newMastery   = -3
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

// ─── POST /api/char-sheet/:characterId/advantages — GM uniquement (octroi narratif) ──
router.post('/:characterId/advantages', async (req, res, next) => {
  try {
    if (!req.isGm && !req.isVaultOwner) throw new AppError(403, 'GM uniquement')

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found — create it first')

    const { advantage_id } = req.body
    if (!advantage_id) throw new AppError(400, 'advantage_id is required')

    const advantage = await grantAdvantage(sheet.id, advantage_id, 'campaign')
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

    const { reason } = req.body || {}
    const advantage = await removeAdvantage(sheet.id, req.params.id, reason)
    res.json({ deleted: true, advantage })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-sheet/:characterId/advantage-notes ─────────────────────────
// ?category=narrative|possession — filtre optionnel (docs/PLAN_WIZARD_MATERIEL.md §5), absent =
// toutes catégories (comportement d'origine préservé pour tout appelant existant).
router.get('/:characterId/advantage-notes', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId })
      .first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const notes = await getAdvantageNotes(sheet.id, req.query.category)
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

    const note = await addAdvantageNote(sheet.id, req.body.label, req.body.category)
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
    if (!req.isGm && !req.isVaultOwner) throw new AppError(403, 'GM uniquement')

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
    if (!req.isGm && !req.isVaultOwner) throw new AppError(403, 'GM uniquement')

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
// ─── POST /api/char-sheet/:characterId/fatigue-test ──────────────────────────
// GM uniquement — docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4. campaignId résolu via
// req.character.campaign_id (patron déjà établi par cette route family, characterId-scope
// uniquement — CharacterSheet.jsx, seule consommatrice, n'a jamais campaignId en prop).
// Body : { source: 'CON'|'VOL'|'ENDURANCE'|'MOYENNE', mjModifier? }
router.post('/:characterId/fatigue-test', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'Seul le MJ peut déclencher un Test de Fatigue')
    const { source, mjModifier } = req.body
    const result = await resolveFatigueTest(req.app.get('io'), req.character.campaign_id, {
      characterId: req.params.characterId, source, mjModifier,
    })
    res.json(result)
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/fatigue-rest ──────────────────────────
// GM uniquement. Body : { full?, caseDelta? }
router.post('/:characterId/fatigue-rest', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'Seul le MJ peut déclencher un Repos')
    const { full, caseDelta } = req.body
    const result = await restFatigue(req.app.get('io'), req.character.campaign_id, req.params.characterId, { full, caseDelta })
    res.json(result)
  } catch (err) { next(err) }
})

router.get('/:characterId/wounds', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.json({ wounds: [], wound_penalty: 0 })

    const wounds = await db('character_wounds')
      .where({ char_sheet_id: sheet.id })
      .orderBy('created_at', 'asc')
    // WNDMORT — wound_penalty reste un nombre pour compat (toujours 0 si Blessure mortelle, jamais
    // -20), wound_test_blocked porte le vrai signal ("aucune action de Test possible") pour la fiche.
    res.json({ wounds, wound_penalty: calcWoundPenalty(wounds), wound_test_blocked: isTestBlockingWound(wounds) })
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

    // applyWound centralise insertion + échéance de Guérison (Lot 2, docs/PLAN_BLESSURES_GUERISON.md
    // §5) + broadcast WOUND_ADDED — cette route ne dupliquait plus que ça avant ce commit.
    const result = await applyWound(req.app.get('io'), db, req.character.campaign_id, {
      charSheetId: sheet.id, characterId: req.params.characterId, localisation: location, severity,
    })
    if (!result) throw new AppError(400, 'Ligne pleine — gravité maximale atteinte pour cette localisation')

    res.status(201).json({
      wound: result.wound, promoted: result.promoted, shock_test_required: result.shock_test_required,
    })
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
// Garde asymétrique (docs/PLAN_ECHANGE.md Lot A0, décision Saar 2026-07-16) : un joueur peut toujours
// dépenser (diminuer) ses propres sols librement, mais seul le MJ peut en faire apparaître (augmenter
// la valeur existante) — évite qu'un joueur restaure par cette route ce qu'un Échange (docs/PLAN_
// ECHANGE.md) vient de lui débiter ailleurs.
router.put('/:characterId/sols', async (req, res, next) => {
  try {
    const { sols } = req.body
    if (!Number.isInteger(sols) || sols < 0) {
      throw new AppError(400, 'sols doit être un entier non négatif')
    }

    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    if (sols > sheet.sols && !req.isGm && !req.isVaultOwner) {
      throw new AppError(403, 'Seul le MJ peut augmenter le total de sols')
    }

    const [updated] = await db('char_sheet')
      .where({ id: sheet.id })
      .update({ sols, updated_at: db.fn.now() })
      .returning('*')

    // Un personnage du Coffre (campaign_id NULL) n'a personne à notifier — même invariant que
    // vaultService.js ("un Vault n'a pas de room à notifier, personne d'autre n'y a accès").
    // io.to(null) n'aurait pas planté (room sans socket), mais l'émetteur n'aurait jamais reçu la
    // confirmation de sa propre action en retour socket — bug latent trouvé en ouvrant cette route
    // au propriétaire du Coffre (docs/EN_COURS.md, 2026-08-16).
    if (req.character.campaign_id) {
      req.app.get('io').to(req.character.campaign_id).emit(WS.SOLS_UPDATED, {
        characterId: req.params.characterId,
        sols: updated.sols,
      })
    }

    res.json({ sols: updated.sols })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/quick-equip ───────────────────────────
// GM uniquement. Équipement d'urgence pré-combat — bypass isContainerAvailable.
// Portée de diffusion inventaire (docs/PLAN_WIZARD_MATERIEL.md §2) : tant que le personnage est un
// brouillon actif (Wizard non terminé), diffuser à wizard:<sheetId> plutôt qu'à toute la room de
// campagne — même principe déjà posé pour les verrous/l'état du Wizard
// (docs/PLAN_WIZARDCOLLAB.md §2.1, "diffusion scopée par ressource, jamais toute la campagne") :
// un membre de la campagne non impliqué dans cette session Wizard ne doit pas apprendre qu'un
// brouillon existe. Comportement inchangé (room de campagne) pour un personnage fini, en jeu réel.
// Un personnage du Coffre (campaign_id NULL, wizard_locked_at posé dès la création —
// charSheetService.js) n'a personne à notifier — même invariant que PUT /sols (2026-08-16, voir son
// commentaire ci-dessous) : retourne explicitement null plutôt que de laisser passer un campaignId
// déjà NULL vers `.to(room).emit()`. `emitInventoryEvent` (ci-dessous) saute l'émission dans ce cas,
// centralisé une fois pour les 7 appelants plutôt qu'un `if (room)` dupliqué à chacun (ticket
// COFFRE-INVROOM1 — la description d'origine visait la branche `wizard:`, obsolète depuis que
// wizard_locked_at n'est plus jamais NULL pour un personnage Coffre direct ; la vraie fuite est ici).
async function resolveInventoryBroadcastRoom(characterId, campaignId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (sheet && !sheet.wizard_locked_at) return `wizard:${sheet.id}`
  return campaignId || null
}

function emitInventoryEvent(io, room, event, payload) {
  if (room) io.to(room).emit(event, payload)
}

router.post('/:characterId/quick-equip', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'GM uniquement')

    const characterId = req.params.characterId
    const { equipment_id, slot } = req.body
    const item = await inventoryService.quickEquip(characterId, equipment_id, slot)

    const room = await resolveInventoryBroadcastRoom(characterId, req.character.campaign_id)
    emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_ADDED, { characterId, item })

    res.status(201).json({ item })
  } catch (err) { next(err) }
})

// ─── POST /api/char-sheet/:characterId/inventory ──────────────────────────────
router.post('/:characterId/inventory', async (req, res, next) => {
  try {
    const characterId = req.params.characterId
    // PLAN_WIZARD_MATERIEL_GAUGES.md §3 — validated_by_gm dérivé serveur (req.isGm), jamais lu du
    // payload : un item ajouté par le joueur part en attente, un item ajouté par le MJ (ou fusionné
    // sur un stack par le MJ) part directement validé. Personnage Coffre-native (campaign_id NULL) :
    // aucun MJ ne peut jamais rejoindre pour valider — auto-validé, sinon l'objet resterait bloqué
    // en attente pour toujours (Saar, décision explicite : pas de validation MJ hors campagne).
    const autoValidate = req.isGm || req.character.campaign_id == null
    const result = await inventoryService.addItem(characterId, req.body, autoValidate, req.isGm)
    const room = await resolveInventoryBroadcastRoom(characterId, req.character.campaign_id)

    if (result.type === 'stack') {
      emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_UPDATED, { characterId, item: result.item })
      return res.json({ item: result.item })
    }
    if (result.type === 'multi') {
      for (const item of result.items) {
        emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_ADDED, { characterId, item })
      }
      return res.status(201).json({ item: result.items[0], items: result.items })
    }

    emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_ADDED, { characterId, item: result.item })
    res.status(201).json({ item: result.item })
  } catch (err) { next(err) }
})

// ─── PUT /api/char-sheet/:characterId/inventory/:itemId ───────────────────────
router.put('/:characterId/inventory/:itemId', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params
    // PLAN_WIZARD_MATERIEL_GAUGES.md §3 — seul le MJ peut faire transiter validated_by_gm ; la route
    // n'avait auparavant aucune garde isGm (les autres champs restent ouverts owner/MJ comme avant).
    if (req.body.validated_by_gm !== undefined && !req.isGm) {
      throw new AppError(403, 'Seul le MJ peut valider un item')
    }
    const { item, cascadedItems } = await inventoryService.updateItem(characterId, itemId, req.body)

    const room = await resolveInventoryBroadcastRoom(characterId, req.character.campaign_id)
    emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_UPDATED, { characterId, item })
    // Cascade INV1 (Sac à dos/Ceinture déséquipé, contenu renvoyé au Coffre) — un event par item
    // déplacé, même mécanisme que ci-dessus, io.to inclut l'émetteur donc pas de refetch client requis.
    for (const cascaded of cascadedItems) {
      emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_UPDATED, { characterId, item: cascaded })
    }

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
    const room = await resolveInventoryBroadcastRoom(characterId, req.character.campaign_id)

    if (result.ammoRemoved) {
      emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_REMOVED, { characterId, itemId: result.ammoItemId })
    } else {
      emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_UPDATED, { characterId, item: result.ammoItem })
    }
    emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_UPDATED, { characterId, item: result.weapon })
    res.json({ item: result.weapon })
  } catch (err) { next(err) }
})

// ─── DELETE /api/char-sheet/:characterId/inventory/:itemId ────────────────────
router.delete('/:characterId/inventory/:itemId', async (req, res, next) => {
  try {
    const { characterId, itemId } = req.params
    const { quantity: qtyToRemove } = req.body || {}
    const result = await inventoryService.removeItem(characterId, itemId, qtyToRemove)
    const room = await resolveInventoryBroadcastRoom(characterId, req.character.campaign_id)

    if (result.deleted) {
      emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_REMOVED, { characterId, itemId })
      return res.json({ deleted: true, itemId })
    }
    emitInventoryEvent(req.app.get('io'), room, WS.INVENTORY_UPDATED, { characterId, item: result.item })
    res.json({ item: result.item })
  } catch (err) { next(err) }
})

// ─── GET /api/char-sheet/:characterId/gauges ────────────────────────────────────
// PLAN_WIZARD_MATERIEL_GAUGES.md §3 — owner ou MJ (garde déjà posée par router.param), partagée
// Wizard Step6 + fiche permanente. Même précédent que GET .../inventory : sans cette route,
// characterStore.gaugesByCharId ne se peuple jamais au premier chargement.
router.get('/:characterId/gauges', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet').where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.json({ gauges: [] })
    const gauges = await db('char_gauges').where({ char_sheet_id: sheet.id }).select('category_key', 'value')
    res.json({ gauges })
  } catch (err) { next(err) }
})

// ─── PATCH /api/char-sheet/:characterId/gauges/:categoryKey ────────────────────
// body: { delta } — MJ only. PLAN_WIZARD_MATERIEL_GAUGES.md §3/§10 (décision Saar 2026-08-12) :
// une jauge ne peut jamais devenir négative — clampée ici, jamais une erreur bloquante pour le MJ ;
// le CHECK chk_gauges_value_non_negative (migration 242) reste le filet de sécurité contre une
// course entre deux écritures concurrentes. Room résolue comme les autres routes inventaire
// (resolveInventoryBroadcastRoom), pas comme SOLS_UPDATED : la jauge est éditable dès Step6, un
// brouillon actif ne doit pas être révélé à toute la room de campagne (même raison que quick-equip/
// addItem, docs/PLAN_WIZARD_MATERIEL.md §2).
router.patch('/:characterId/gauges/:categoryKey', async (req, res, next) => {
  try {
    if (!req.isGm) throw new AppError(403, 'GM uniquement')

    const { characterId, categoryKey } = req.params
    const { delta } = req.body
    if (!Number.isInteger(delta)) throw new AppError(400, 'delta doit être un entier')

    const sheet = await db('char_sheet').where({ character_id: characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const [updated] = await db('char_gauges')
      .insert({ char_sheet_id: sheet.id, category_key: categoryKey, value: Math.max(0, delta) })
      .onConflict(['char_sheet_id', 'category_key'])
      .merge({ value: db.raw('GREATEST(0, char_gauges.value + ?)', [delta]) })
      .returning('*')

    const room = await resolveInventoryBroadcastRoom(characterId, req.character.campaign_id)
    emitInventoryEvent(req.app.get('io'), room, WS.GAUGE_UPDATED, {
      characterId, categoryKey, value: updated.value,
    })

    res.json({ categoryKey, value: updated.value })
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
      { id: 'resistance_dommages',  label: 'Résistance aux dommages' },
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

    // Point structurel 3 (docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4) : les macros ignoraient jusqu'ici
    // tout malus de blessure/encombrement/fatigue — corrigé en branchant le même registre que les
    // sites combat, wounds/char_inventory/settings ajoutés au même Promise.all déjà en place.
    const [attrs, archetype, mutationEffects, advantages, wounds, invItems, settings] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheet.id }),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      getMutationEffects(sheet.id),
      getAdvantages(sheet.id),
      db('character_wounds').where({ char_sheet_id: sheet.id }),
      db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.character_id': req.params.characterId })
        .select('char_inventory.container', 'ref_equipment.weight as ref_weight', 'char_inventory.quantity'),
      getCampaignSettings(db, req.character.campaign_id),
    ])
    const genotypeRow = archetype?.genotype_id
      ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
      : null

    const na = (attrId) => calcAttributeNA(attrs, attrId, genotypeRow, mutationEffects)
    const totalWeight = invItems.reduce((sum, item) =>
      (item.container === 'Coffre' || item.ref_weight == null) ? sum : sum + item.ref_weight * item.quantity, 0
    )
    const activeMalus = calcActiveMalus({
      wounds, fatiguePoints: sheet.fatigue_points, totalWeight, forNA: na('FOR'), settings,
    })

    const secondaryValue = (key) => {
      switch (key) {
        case 'rea':                return calcREA(na('ADA'), na('PER'), getAdvantageModForAttr(advantages, 'reaction'))
        case 'seuil_etourdi':      return calcSeuils(na('FOR'), na('CON'), na('VOL'), getMutationModForResistance(mutationEffects, 'shock'), getAdvantageModForResistance(advantages, 'shock')).etourdissement
        case 'seuil_incons':       return calcSeuils(na('FOR'), na('CON'), na('VOL'), getMutationModForResistance(mutationEffects, 'shock'), getAdvantageModForResistance(advantages, 'shock')).inconscience
        case 'souffle':            return calcSouffle(na('CON'), na('VOL'), getAdvantageModForAttr(advantages, 'breath'))
        case 'resistance_dommages':  return calcResistanceDommages(na('FOR'), na('CON'), getMutationModForResistance(mutationEffects, 'damage') + getNaturalArmorMod(mutationEffects), getAdvantageModForResistance(advantages, 'damage'))
        case 'resistance_drogues':   return calcResistanceNaturelle(calcResistanceDroguesInput(na('CON'), na('VOL'))) + getMutationModForResistance(mutationEffects, 'drugs') + getAdvantageModForResistance(advantages, 'drugs')
        case 'resistance_poison':    return calcResistanceNaturelle(na('CON')) + getMutationModForResistance(mutationEffects, 'poison') + getAdvantageModForResistance(advantages, 'poison')
        case 'resistance_maladie':   return calcResistanceNaturelle(na('CON')) + getMutationModForResistance(mutationEffects, 'disease') + getAdvantageModForResistance(advantages, 'disease')
        case 'resistance_radiation': return calcResistanceNaturelle(na('CON')) + getMutationModForResistance(mutationEffects, 'radiation') + getAdvantageModForResistance(advantages, 'radiation')
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

    res.json({ threshold: baseThreshold + activeMalus + Number(modifier) })
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

    const updated = await db.transaction(async (trx) => {
      const count = await trx('char_inventory')
        .where({ id: req.params.invId, character_id: drone.id })
        .update({ character_id: ownerChar.id, container })
      // Lot C (docs/PLAN_INVENTORY_SLOTS.md) : un transfert de propriété déséquipe toujours l'item —
      // plus de `slot: null` (colonne retirée), vider char_inventory_slots à la place.
      if (count) await trx('char_inventory_slots').where({ char_inventory_id: req.params.invId }).del()
      return count
    })
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

// ─── Routes exo-armure ──────────────────────────────────────────────────────────
// Ownership : router.param laisse passer tous les membres pour les exo-armures (isExo bypass,
// même patron que le drone — patron confirmé Saar 2026-08-06, docs/PLANS/PLAN_EXOARMURE.md §6.3).
// Écritures : GM, propriétaire (characters.user_id) OU pilote lié (exo_sheet.pilot_character_id ->
// characters.user_id) — décision Saar 2026-07-30, tranchée pour donner au pilote les pleins droits
// de modification sur l'armure qu'il pilote, pas seulement la possibilité de s'en dissocier.

// Helper — GM, propriétaire OU pilote lié (référence croisée, donc async contrairement à
// droneIsGmOrOwner qui ne lit que la ligne characters déjà chargée par router.param). Délègue à
// combatantContextService.js:isExoActorAuthorized (même autorité étendue à la déclaration de combat,
// PLAN_EXOARMURE.md Lot 2bis §9.3, Règle 2 documentaire — une seule copie de ce prédicat). `exoSheet`
// n'est plus utilisé ici (isExoActorAuthorized résout le pilote elle-même via resolveExoContext) —
// un second aller-retour DB minime, accepté : ces deux sites sont des gardes ponctuelles avant PUT,
// pas un chemin chaud, pas la peine d'étendre la signature partagée pour cette seule optimisation.
async function exoIsGmOrOwnerOrPilot(req, _exoSheet) {
  return isExoActorAuthorized(db, req.character, { isGm: req.isGm, userId: req.user.id })
}

// GET /:characterId/exo — fiche + nom/illustration du modèle d'origine (affichage seul, ex.
// "pré-rempli depuis : Armure Mentor"). Lot B (§13.3, 2026-08-20) : plus de JOIN complet vers
// ref_exo_templates — les 19 champs de base vivent nativement sur exo_sheet.*, `template_id` n'est
// plus qu'une référence d'origine. `template_illustration_url` ajoutée migration 263 (§15) : trouvée
// manquante par Saar (RT-4/Vanguard sans illustration en réglages) — la jointure existait déjà, seule
// la colonne n'était pas sélectionnée.
router.get('/:characterId/exo', async (req, res, next) => {
  try {
    const exo = await db('exo_sheet')
      .where({ 'exo_sheet.character_id': req.params.characterId })
      .leftJoin('ref_exo_templates', 'exo_sheet.template_id', 'ref_exo_templates.id')
      .select('exo_sheet.*', 'ref_exo_templates.name as template_name', 'ref_exo_templates.illustration_url as template_illustration_url')
      .first()
    if (!exo) return res.json({ exo: null })

    res.json({ exo })
  } catch (err) { next(err) }
})

// Champs de base éditables directement (Lot B, §13.3) — mêmes 19 champs que ceux copiés par
// applyExoTemplate + 3 nouveaux narratifs (taille/type_batterie/type_coque, sans équivalent côté
// ref_exo_templates). Séparée de COPIED_FROM_TEMPLATE_COLUMNS (exoTemplateService.js/migration 254) :
// cette liste-ci est "ce qu'un humain peut éditer à la main sur cette route", pas "ce qu'un modèle
// copie" — les deux listes se recouvrent aujourd'hui mais n'ont pas la même raison d'exister.
const EXO_BASE_WHITELIST_FIELDS = [
  'category', 'environment', 'depth_operational', 'depth_limit', 'depth_crush',
  'base_exoforce', 'base_blindage', 'base_speed_underwater', 'base_speed_surface',
  'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
  'malus_init_underwater', 'malus_init_surface',
  'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
  'taille', 'type_batterie', 'type_coque', 'notes',
]

// PUT /:characterId/exo — fiche descriptive (pilot_character_id, template_id) + base éditable (Lot B)
router.put('/:characterId/exo', async (req, res, next) => {
  try {
    const exoSheet = await db('exo_sheet').where({ character_id: req.params.characterId }).first()
    if (!exoSheet) throw new AppError(404, 'Exo sheet not found')
    if (!await exoIsGmOrOwnerOrPilot(req, exoSheet)) throw new AppError(403, 'GM, owner or pilot required')

    const { pilot_character_id, template_id } = req.body

    // Sélection de modèle — exclusivité stricte (analyse à charge 2026-08-20) : template_id non-null
    // combiné à un autre champ dans la même requête est un 400 explicite, jamais un silence qui
    // ignorerait les autres champs (le client actuel n'envoie de toute façon jamais les deux
    // ensemble). template_id: null (dissociation) reste un champ ordinaire du patch générique
    // ci-dessous — ne réinitialise jamais les champs déjà copiés (§13.3, décision actée).
    if (template_id !== undefined && template_id !== null) {
      const otherFieldsProvided = Object.keys(req.body).some(k => k !== 'template_id')
      if (otherFieldsProvided) {
        throw new AppError(400, 'template_id must be sent alone — no other field in the same request')
      }
      const exo = await applyExoTemplate(db, req.params.characterId, template_id)
      if (!exo) throw new AppError(404, 'Template not found')
      return res.json({ exo })
    }

    const updates = {}

    if (pilot_character_id !== undefined) {
      if (pilot_character_id !== null) {
        // Invariant Lot 1 (§6.5) : un pilote est toujours un personnage humain (pj/pnj) — un drone
        // ou une autre exo-armure assigné comme pilote est un non-sens RAW, rejeté explicitement.
        // Référence croisée inter-lignes : ne peut pas être portée par un CHECK Postgres.
        const target = await db('characters').where({ id: pilot_character_id }).first()
        if (!target || !['pj', 'pnj'].includes(target.type)) {
          throw new AppError(400, 'pilot_character_id must reference a pj or pnj character')
        }
      }
      updates.pilot_character_id = pilot_character_id
    }
    if (template_id !== undefined) updates.template_id = null  // dissociation, cf. garde ci-dessus

    for (const field of EXO_BASE_WHITELIST_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    }

    // Validation tout-ou-rien des 4 champs contraints par CHECK (mêmes listes blanches que la
    // migration 254) — avant le moindre UPDATE, jamais une application partielle des champs valides
    // pendant qu'un champ invalide est rejeté séparément (même discipline que `severity` au Lot A).
    if ('category' in updates && !EXO_CATEGORY_ORDER.includes(updates.category)) {
      throw new AppError(400, 'Invalid category')
    }
    if ('environment' in updates && !EXO_ENVIRONMENT_VALUES.includes(updates.environment)) {
      throw new AppError(400, 'Invalid environment')
    }
    if ('underwater_movement_mode' in updates && !EXO_MOVEMENT_MODE_VALUES.includes(updates.underwater_movement_mode)) {
      throw new AppError(400, 'Invalid underwater_movement_mode')
    }
    if ('surface_movement_mode' in updates && !EXO_MOVEMENT_MODE_VALUES.includes(updates.surface_movement_mode)) {
      throw new AppError(400, 'Invalid surface_movement_mode')
    }
    // jsonb round-trippé depuis un body JSON déjà désérialisé — même sérialisation explicite que
    // exoTemplateService.js (sinon le driver pg écrit un littéral tableau Postgres, pas du JSON).
    if ('speeds_extra' in updates) updates.speeds_extra = JSON.stringify(updates.speeds_extra)

    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    let exo
    try {
      ;[exo] = await db('exo_sheet')
        .where({ character_id: req.params.characterId })
        .update(updates)
        .returning('*')
    } catch (err) {
      // Index unique partiel exo_sheet_pilot_unique — traduire l'erreur Postgres brute
      if (err.constraint === 'exo_sheet_pilot_unique') {
        throw new AppError(409, 'This character already pilots another exo-suit')
      }
      throw err
    }

    res.json({ exo })
  } catch (err) { next(err) }
})

// PUT /:characterId/exo/integrity — Intégrité Structure/Exosquelette/Générateur (max + current)
router.put('/:characterId/exo/integrity', async (req, res, next) => {
  try {
    const exoSheet = await db('exo_sheet').where({ character_id: req.params.characterId }).first()
    if (!exoSheet) throw new AppError(404, 'Exo sheet not found')
    if (!await exoIsGmOrOwnerOrPilot(req, exoSheet)) throw new AppError(403, 'GM, owner or pilot required')

    const {
      itg_structure_max, itg_structure_current,
      itg_exosquelette_max, itg_exosquelette_current,
      itg_generator_max, itg_generator_current,
    } = req.body
    const updates = {}
    if (itg_structure_max        !== undefined) updates.itg_structure_max = itg_structure_max
    if (itg_structure_current    !== undefined) updates.itg_structure_current = itg_structure_current
    if (itg_exosquelette_max     !== undefined) updates.itg_exosquelette_max = itg_exosquelette_max
    if (itg_exosquelette_current !== undefined) updates.itg_exosquelette_current = itg_exosquelette_current
    if (itg_generator_max        !== undefined) updates.itg_generator_max = itg_generator_max
    if (itg_generator_current    !== undefined) updates.itg_generator_current = itg_generator_current
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const [exo] = await db('exo_sheet')
      .where({ character_id: req.params.characterId })
      .update(updates)
      .returning('*')

    res.json({ exo })
  } catch (err) { next(err) }
})

// POST /:characterId/exo/avaries/:severity — pose une Avarie (GM, propriétaire ou pilote), même
// fonction que le pipeline de combat (exoAvarieService.applyExoAvarie, PLAN_EXOARMURE.md §13.2) —
// jamais une copie. `severity` vient du client pour la première fois (jusqu'ici toujours calculée
// côté serveur par severityForExoDamage) : validée contre la liste blanche avant tout accès DB,
// 'destruction' rejeté explicitement (RAW : aucune case pour ce palier).
router.post('/:characterId/exo/avaries/:severity', async (req, res, next) => {
  try {
    const { severity } = req.params
    if (severity === 'destruction' || !EXO_AVARIE_SEVERITY_ORDER.includes(severity)) {
      throw new AppError(400, 'Invalid severity')
    }

    const exoSheet = await db('exo_sheet').where({ character_id: req.params.characterId }).first()
    if (!exoSheet) throw new AppError(404, 'Exo sheet not found')
    if (!await exoIsGmOrOwnerOrPilot(req, exoSheet)) throw new AppError(403, 'GM, owner or pilot required')

    const result = await applyExoAvarie(req.app.get('io'), db, req.character.campaign_id, {
      characterId: req.params.characterId, severity,
    })
    if (!result) throw new AppError(404, 'Exo sheet not found')

    res.json({ exo: result.exoSheet })
  } catch (err) { next(err) }
})

// DELETE /:characterId/exo/avaries/:severity — retire une Avarie, GM uniquement (PLAN_EXOARMURE.md
// §13.2 : outil de correction MJ, aucune contrepartie RAW côté joueur — retirer une Avarie sans Test
// n'a pas d'équivalent légitime, contrairement à la Guérison d'une Blessure). Pas de fetch exoSheet
// préalable : req.isGm ne dépend pas de la fiche, et removeExoAvarie retourne déjà null sur "introuvable".
router.delete('/:characterId/exo/avaries/:severity', async (req, res, next) => {
  try {
    const { severity } = req.params
    if (severity === 'destruction' || !EXO_AVARIE_SEVERITY_ORDER.includes(severity)) {
      throw new AppError(400, 'Invalid severity')
    }
    if (!req.isGm) throw new AppError(403, 'GM required')

    const result = await removeExoAvarie(req.app.get('io'), db, req.character.campaign_id, {
      characterId: req.params.characterId, severity,
    })
    if (!result) throw new AppError(404, 'Exo sheet not found')

    res.json({ exo: result.exoSheet })
  } catch (err) { next(err) }
})

// ─── Routes exo-armure — Systèmes / Armement / Programmes / Ordinateur (Lot C, PLAN_EXOARMURE.md
// §13.4) ─────────────────────────────────────────────────────────────────────────────────────────
// 4 familles, patron uniforme : une route GET dédiée par famille, jamais agrégée dans
// GET /:characterId/exo (décision explicite 2026-08-21 — le précédent drone est lui-même asymétrique
// entre programmes agrégés dans son GET principal et armes séparées, pas un choix délibéré à
// reproduire). Permission uniforme `exoIsGmOrOwnerOrPilot` sur toutes les écritures (fiche éditable
// normale, pas un outil de correction MJ comme les Avaries) — jamais la vérification inline
// `req.character.user_id === req.user.id` que le drone réimplémente par erreur sur
// PUT /drone/weapons/:id (incohérence préexistante, pas reproduite ici). Aucun fetch `exo_sheet`
// séparé avant permission/écriture (contrairement aux routes Avaries plus haut) : `req.character` est
// déjà résolu par `router.param('characterId')`, `exoIsGmOrOwnerOrPilot` fonctionne dessus seul, et le
// lookup `{id, character_id}` de chaque PUT/DELETE filtre déjà l'appartenance — mirror le précédent le
// plus proche (`drone_weapons`/`drone_programs` PUT/DELETE), pas les Avaries (compteurs sur la fiche
// elle-même, pas des lignes filles).

// Requêtes enrichies (jointure ref_equipment → display_name) partagées entre GET (liste) et POST/PUT
// (réponse d'une seule ligne) — trouvaille 2026-08-21 (Saar, test réel navigateur) : POST/PUT
// renvoyaient la ligne brute `.returning('*')` sans jointure, contrairement à GET, donc sans
// `display_name` ; l'ajout/l'édition d'un système ou d'une arme catalogue affichait "—" côté client
// jusqu'au prochain GET (mirror manqué du précédent `drone_weapons`, qui refait bien cette jointure
// après `insert`/`update`, `char-sheet.js:1842-1856,1885-1899`). Une seule fonction par table plutôt
// que dupliquer le SELECT 3 fois (GET liste + POST + PUT) — même shape garanti partout.
// Un seul catalogue depuis la fusion ref_exo_equipment → ref_equipment (PLAN_EXOEQ_FUSION.md) —
// l'exclusive arc à 2 sources (migrations 260/262, archivées) n'a plus lieu d'être : il ne reste
// qu'une seule vraie source catalogue possible (`ref_equipment_id`), plus de COALESCE entre 2 tables.
function selectExoSystemFields(query) {
  return query
    .leftJoin('ref_equipment', 'exo_systems.ref_equipment_id', 'ref_equipment.id')
    .select(
      'exo_systems.*',
      db.raw('COALESCE(exo_systems.label_override, ref_equipment.name) as display_name'),
      'ref_equipment.description as ref_description',
      'ref_equipment.category as ref_category',
    )
}

function selectExoWeaponFields(query) {
  return query
    .leftJoin('ref_equipment', 'exo_weapons.ref_equipment_id', 'ref_equipment.id')
    .select(
      'exo_weapons.*',
      db.raw('COALESCE(exo_weapons.label_override, ref_equipment.name) as display_name'),
      'ref_equipment.description as ref_description',
      'ref_equipment.damage_h as ref_damage',
      'ref_equipment.shock as ref_shock',
      'ref_equipment.range as ref_range',
      'ref_equipment.fire_mode as ref_fire_mode',
      // ref_category — même discriminant Tir/CaC que le serveur (socketCombatExo.js,
      // resolveExoMeleeAction : category !== 'Arme de contact'), jamais déduit côté client de
      // fire_mode nul (coïncidence catalogue actuelle, pas la règle) — PLAN_EXOARMURE.md §16.4.
      'ref_equipment.category as ref_category',
    )
}

// Validation de la source d'une ligne exo_systems/exo_weapons — un seul catalogue depuis la fusion
// (PLAN_EXOEQ_FUSION.md) : `ref_equipment_id` et/ou `label_override`, au moins un des deux renseigné
// (`label_override` peut coexister comme annotation d'affichage, ex. "SACEA (secours)" — décision
// migration 262 archivée, toujours valable). Le CHECK Postgres reste l'autorité finale, valider ici
// évite un 500 brut au profit d'un AppError 400 lisible — même raisonnement que templateId/UUID_RE
// dans exoTemplateService.js.
function validateExoEquipmentSource({ ref_equipment_id, label_override }) {
  const hasSource = ref_equipment_id != null && ref_equipment_id !== ''
  const hasLabel = label_override != null && label_override !== ''
  if (!hasSource && !hasLabel) {
    throw new AppError(400, 'Fournir au moins un parmi ref_equipment_id, label_override')
  }
}

// GET /:characterId/exo/systems
router.get('/:characterId/exo/systems', async (req, res, next) => {
  try {
    const systems = await selectExoSystemFields(
      db('exo_systems').where({ 'exo_systems.character_id': req.params.characterId })
    )
      .orderBy('exo_systems.sort_order', 'asc')
      .orderBy('exo_systems.id', 'asc')
    res.json({ systems })
  } catch (err) { next(err) }
})

// POST /:characterId/exo/systems — ajouter un système (catalogue ou custom via label_override)
router.post('/:characterId/exo/systems', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { ref_equipment_id, label_override, level, integrite_max, integrite_current, sort_order = 0 } = req.body
    validateExoEquipmentSource({ ref_equipment_id, label_override })

    if (ref_equipment_id) {
      // Filtre famille seulement pour rejeter le mauvais catalogue exo (ex. poster une arme exo sur
      // ce endpoint système) — tout item générique du catalogue (ni Exo-systeme ni Exo-arme) reste
      // accepté sans restriction, même comportement que l'ancien branchement ref_equipment_id
      // (pré-fusion) qui n'avait aucun filtre de famille.
      const ref = await db('ref_equipment').where({ id: ref_equipment_id }).first()
      if (!ref) throw new AppError(400, 'Equipment not found')
      if (ref.family === 'Exo-arme') throw new AppError(400, 'Equipment not found or not a system')
    }

    const [inserted] = await db('exo_systems')
      .insert({
        character_id: req.params.characterId,
        ref_equipment_id: ref_equipment_id ?? null,
        label_override: label_override ?? null,
        level: level ?? null,
        integrite_max: integrite_max ?? null,
        integrite_current: integrite_current ?? integrite_max ?? null,
        sort_order,
      })
      .returning('id')
    const system = await selectExoSystemFields(db('exo_systems').where({ 'exo_systems.id': inserted.id })).first()

    res.status(201).json({ system })
  } catch (err) { next(err) }
})

// PUT /:characterId/exo/systems/:systemId
router.put('/:characterId/exo/systems/:systemId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { label_override, level, integrite_max, integrite_current, sort_order } = req.body
    const updates = {}
    if (label_override   !== undefined) updates.label_override   = label_override
    if (level             !== undefined) updates.level             = level
    if (integrite_max     !== undefined) updates.integrite_max     = integrite_max
    if (integrite_current !== undefined) updates.integrite_current = integrite_current
    if (sort_order        !== undefined) updates.sort_order        = sort_order
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const existing = await db('exo_systems')
      .where({ id: req.params.systemId, character_id: req.params.characterId })
      .first()
    if (!existing) throw new AppError(404, 'System not found')

    await db('exo_systems').where({ id: req.params.systemId }).update(updates)
    const system = await selectExoSystemFields(db('exo_systems').where({ 'exo_systems.id': req.params.systemId })).first()
    res.json({ system })
  } catch (err) { next(err) }
})

// DELETE /:characterId/exo/systems/:systemId
router.delete('/:characterId/exo/systems/:systemId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const deleted = await db('exo_systems')
      .where({ id: req.params.systemId, character_id: req.params.characterId })
      .delete()
    if (!deleted) throw new AppError(404, 'System not found')

    res.json({ message: 'System deleted' })
  } catch (err) { next(err) }
})

// GET /:characterId/exo/movement — Allures (lente/moyenne/rapide/max, en mètres) pour le survol de
// déplacement combat (PLAN_EXOARMURE.md §16.3). Le calcul VIT/3-modes (surface/sous-marine, délégation
// au pilote, milieu bloqué) vit uniquement dans getExoMovementBudget (movementBudgetService.js) — ne
// jamais le réimplémenter côté client (CLAUDE.md §7), cette route expose juste son résultat.
router.get('/:characterId/exo/movement', async (req, res, next) => {
  try {
    const budget = await getCharacterMovementBudget(req.params.characterId, 'lente')
    res.json({ allures: budget.allures })
  } catch (err) {
    if (err instanceof TypeError || err instanceof RangeError) return next(new AppError(400, err.message))
    next(err)
  }
})

// GET /:characterId/exo/weapons
router.get('/:characterId/exo/weapons', async (req, res, next) => {
  try {
    const weapons = await selectExoWeaponFields(
      db('exo_weapons').where({ 'exo_weapons.character_id': req.params.characterId })
    )
      .orderBy('exo_weapons.sort_order', 'asc')
      .orderBy('exo_weapons.id', 'asc')
    res.json({ weapons })
  } catch (err) { next(err) }
})

// POST /:characterId/exo/weapons — ajouter une arme (catalogue ou custom via label_override)
router.post('/:characterId/exo/weapons', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { ref_equipment_id, label_override, integrite_max, integrite_current, sort_order = 0 } = req.body
    validateExoEquipmentSource({ ref_equipment_id, label_override })

    if (ref_equipment_id) {
      // Symétrique de la route /exo/systems ci-dessus.
      const ref = await db('ref_equipment').where({ id: ref_equipment_id }).first()
      if (!ref) throw new AppError(400, 'Equipment not found')
      if (ref.family === 'Exo-systeme') throw new AppError(400, 'Equipment not found or not a weapon')
    }

    const [inserted] = await db('exo_weapons')
      .insert({
        character_id: req.params.characterId,
        ref_equipment_id: ref_equipment_id ?? null,
        label_override: label_override ?? null,
        integrite_max: integrite_max ?? null,
        integrite_current: integrite_current ?? integrite_max ?? null,
        sort_order,
      })
      .returning('id')
    const weapon = await selectExoWeaponFields(db('exo_weapons').where({ 'exo_weapons.id': inserted.id })).first()

    res.status(201).json({ weapon })
  } catch (err) { next(err) }
})

// PUT /:characterId/exo/weapons/:weaponId
router.put('/:characterId/exo/weapons/:weaponId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { label_override, integrite_max, integrite_current, sort_order } = req.body
    const updates = {}
    if (label_override   !== undefined) updates.label_override   = label_override
    if (integrite_max     !== undefined) updates.integrite_max     = integrite_max
    if (integrite_current !== undefined) updates.integrite_current = integrite_current
    if (sort_order        !== undefined) updates.sort_order        = sort_order
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const existing = await db('exo_weapons')
      .where({ id: req.params.weaponId, character_id: req.params.characterId })
      .first()
    if (!existing) throw new AppError(404, 'Weapon not found')

    await db('exo_weapons').where({ id: req.params.weaponId }).update(updates)
    const weapon = await selectExoWeaponFields(db('exo_weapons').where({ 'exo_weapons.id': req.params.weaponId })).first()
    res.json({ weapon })
  } catch (err) { next(err) }
})

// DELETE /:characterId/exo/weapons/:weaponId
router.delete('/:characterId/exo/weapons/:weaponId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const deleted = await db('exo_weapons')
      .where({ id: req.params.weaponId, character_id: req.params.characterId })
      .delete()
    if (!deleted) throw new AppError(404, 'Weapon not found')

    res.json({ message: 'Weapon deleted' })
  } catch (err) { next(err) }
})

// GET /:characterId/exo/computers
router.get('/:characterId/exo/computers', async (req, res, next) => {
  try {
    const computers = await db('exo_computers')
      .where({ character_id: req.params.characterId })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    res.json({ computers })
  } catch (err) { next(err) }
})

// POST /:characterId/exo/computers — ajouter un ordinateur custom (au-delà du loadout de modèle,
// §13.4.4) — Intégrité fournie directement par l'appelant (pas de jet serveur ici, contrairement à
// applyExoTemplate : un ajout manuel n'est pas "neuf sorti d'usine", laissé au jugement MJ).
router.post('/:characterId/exo/computers', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { role, gen, nt, blindage_iem, integrite_max, integrite_current, sort_order = 0 } = req.body
    if (!EXO_COMPUTER_ROLE_VALUES.includes(role)) throw new AppError(400, 'Invalid role')
    if (gen == null || nt == null) throw new AppError(400, 'gen et nt sont requis')

    const [computer] = await db('exo_computers')
      .insert({
        character_id: req.params.characterId,
        role, gen, nt,
        blindage_iem: blindage_iem ?? null,
        integrite_max: integrite_max ?? null,
        integrite_current: integrite_current ?? integrite_max ?? null,
        sort_order,
      })
      .returning('*')

    res.status(201).json({ computer })
  } catch (err) { next(err) }
})

// PUT /:characterId/exo/computers/:computerId
router.put('/:characterId/exo/computers/:computerId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { role, gen, nt, blindage_iem, integrite_max, integrite_current, sort_order } = req.body
    if (role !== undefined && !EXO_COMPUTER_ROLE_VALUES.includes(role)) throw new AppError(400, 'Invalid role')

    const updates = {}
    if (role              !== undefined) updates.role              = role
    if (gen                !== undefined) updates.gen                = gen
    if (nt                 !== undefined) updates.nt                 = nt
    if (blindage_iem       !== undefined) updates.blindage_iem       = blindage_iem
    if (integrite_max      !== undefined) updates.integrite_max      = integrite_max
    if (integrite_current  !== undefined) updates.integrite_current  = integrite_current
    if (sort_order         !== undefined) updates.sort_order         = sort_order
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

    const existing = await db('exo_computers')
      .where({ id: req.params.computerId, character_id: req.params.characterId })
      .first()
    if (!existing) throw new AppError(404, 'Computer not found')

    const [computer] = await db('exo_computers')
      .where({ id: req.params.computerId })
      .update(updates)
      .returning('*')
    res.json({ computer })
  } catch (err) { next(err) }
})

// DELETE /:characterId/exo/computers/:computerId — un programme rattaché survit (SET NULL,
// migration 258), jamais entraîné dans la suppression.
router.delete('/:characterId/exo/computers/:computerId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const deleted = await db('exo_computers')
      .where({ id: req.params.computerId, character_id: req.params.characterId })
      .delete()
    if (!deleted) throw new AppError(404, 'Computer not found')

    res.json({ message: 'Computer deleted' })
  } catch (err) { next(err) }
})

// GET /:characterId/exo/programs
router.get('/:characterId/exo/programs', async (req, res, next) => {
  try {
    const programs = await db('exo_programs')
      .where({ 'exo_programs.character_id': req.params.characterId })
      .leftJoin('ref_equipment', 'exo_programs.equipment_id', 'ref_equipment.id')
      .select(
        'exo_programs.id', 'exo_programs.character_id', 'exo_programs.equipment_id',
        'exo_programs.label_override', 'exo_programs.category', 'exo_programs.level',
        'exo_programs.exo_computer_id', 'exo_programs.sort_order',
        'ref_equipment.name as program_name', 'ref_equipment.description as program_description',
      )
      .orderBy('exo_programs.sort_order', 'asc')
      .orderBy('exo_programs.id', 'asc')
    res.json({ programs })
  } catch (err) { next(err) }
})

// POST /:characterId/exo/programs — ajouter un programme (catalogue ou custom).
// exo_computer_id optionnel : le RAW ("Potentiel"/"Niveau max. des programmes") plafonne par
// ORDINATEUR précis, jamais par armure entière — une exo peut porter 0/1/2 ordinateurs
// (PLAN_EXOARMURE.md §13.4.1). Si fourni, valide contre CET ordinateur (mirror la validation déjà
// existante côté drone, qui n'a jamais cette ambiguïté avec son ordinateur unique) ; si absent, aucune
// validation — même comportement que le drone quand ordinateur_gen/nt sont NULL.
router.post('/:characterId/exo/programs', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const { equipment_id, label_override, level, exo_computer_id, sort_order = 0 } = req.body
    if (!equipment_id && !label_override) throw new AppError(400, 'equipment_id ou label_override requis')
    if (level === undefined || level === null) throw new AppError(400, 'level is required')
    if (level < 0 || level > 30) throw new AppError(400, 'level must be between 0 and 30')

    let category
    if (equipment_id) {
      // family: 'Logiciels' — divergence volontaire par rapport à drone_programs (qui ne filtre pas),
      // catalogue partagé et volontairement large (34 lignes couvrant esquive/pilotage de drone,
      // sécurité/piratage d'ordinateur, médical, sciences — RAW traite l'Ordinateur comme un
      // sous-système générique "incorporé à des ordinateurs de drones ou d'appareils",
      // REGLE_ORDINATEUR.md:101, jamais un catalogue séparé par plateforme). Le filtre empêche
      // seulement d'assigner une arme/armure comme "programme" par erreur — pas de sous-filtre par
      // category (esquive/medical/...), laissé au jugement MJ comme RAW ne distingue pas non plus
      // quel type de programme convient à quelle plateforme.
      const ref = await db('ref_equipment').where({ id: equipment_id, family: 'Logiciels' }).select('category').first()
      if (!ref) throw new AppError(404, 'Programme introuvable dans le catalogue')
      category = ref.category
    } else {
      category = req.body.category
      if (!category) throw new AppError(400, 'category requis pour un programme custom')
    }

    if (exo_computer_id) {
      const computer = await db('exo_computers')
        .where({ id: exo_computer_id, character_id: req.params.characterId })
        .first()
      if (!computer) throw new AppError(400, 'exo_computer_id must reference a computer belonging to this character')

      const stats = computeOrdinateurStats({ gen: computer.gen, nt: computer.nt })
      if (level > stats.niveauMaxProgrammes) throw new AppError(400, `Niveau max pour cet ordinateur : ${stats.niveauMaxProgrammes}`)
      const row = await db('exo_programs').where({ exo_computer_id }).sum('level as total').first()
      if ((Number(row.total) || 0) + level > stats.potentiel) {
        throw new AppError(400, `Potentiel total dépassé (max : ${stats.potentiel})`)
      }
    }

    const [program] = await db('exo_programs')
      .insert({
        character_id: req.params.characterId,
        equipment_id: equipment_id ?? null,
        label_override: label_override ?? null,
        category,
        level,
        exo_computer_id: exo_computer_id ?? null,
        sort_order,
      })
      .returning('*')

    const enriched = { ...program }
    if (equipment_id) {
      const ref = await db('ref_equipment').where({ id: equipment_id }).select('name', 'description').first()
      enriched.program_name = ref?.name ?? null
      enriched.program_description = ref?.description ?? null
    }

    res.status(201).json({ program: enriched })
  } catch (err) { next(err) }
})

// PUT /:characterId/exo/programs/:programId — level/exo_computer_id/sort_order modifiables.
// Potentiel/Niveau max REVALIDÉS si level ou exo_computer_id changent — divergence assumée par
// rapport au précédent drone_programs (qui ne revalide jamais au PUT, seulement les bornes 0-30 ;
// gap préexistant non instrumenté ici, code neuf qui n'a pas de raison de le reproduire).
router.put('/:characterId/exo/programs/:programId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const existing = await db('exo_programs')
      .where({ id: req.params.programId, character_id: req.params.characterId })
      .first()
    if (!existing) throw new AppError(404, 'Program not found')

    const { level, exo_computer_id, sort_order } = req.body
    const updates = {}
    if (level           !== undefined) updates.level           = level
    if (exo_computer_id !== undefined) updates.exo_computer_id = exo_computer_id
    if (sort_order      !== undefined) updates.sort_order      = sort_order
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')
    if (updates.level !== undefined && (updates.level < 0 || updates.level > 30)) {
      throw new AppError(400, 'level must be between 0 and 30')
    }

    const effectiveComputerId = updates.exo_computer_id !== undefined ? updates.exo_computer_id : existing.exo_computer_id
    const effectiveLevel = updates.level !== undefined ? updates.level : existing.level
    if (effectiveComputerId) {
      const computer = await db('exo_computers')
        .where({ id: effectiveComputerId, character_id: req.params.characterId })
        .first()
      if (!computer) throw new AppError(400, 'exo_computer_id must reference a computer belonging to this character')

      const stats = computeOrdinateurStats({ gen: computer.gen, nt: computer.nt })
      if (effectiveLevel > stats.niveauMaxProgrammes) throw new AppError(400, `Niveau max pour cet ordinateur : ${stats.niveauMaxProgrammes}`)
      const row = await db('exo_programs')
        .where({ exo_computer_id: effectiveComputerId })
        .andWhere('id', '!=', req.params.programId)
        .sum('level as total').first()
      if ((Number(row.total) || 0) + effectiveLevel > stats.potentiel) {
        throw new AppError(400, `Potentiel total dépassé (max : ${stats.potentiel})`)
      }
    }

    const [updated] = await db('exo_programs')
      .where({ id: req.params.programId })
      .update(updates)
      .returning('*')

    const enriched = { ...updated }
    if (updated.equipment_id) {
      const ref = await db('ref_equipment').where({ id: updated.equipment_id }).select('name', 'description').first()
      enriched.program_name = ref?.name ?? null
      enriched.program_description = ref?.description ?? null
    }

    res.json({ program: enriched })
  } catch (err) { next(err) }
})

// DELETE /:characterId/exo/programs/:programId
router.delete('/:characterId/exo/programs/:programId', async (req, res, next) => {
  try {
    if (!await exoIsGmOrOwnerOrPilot(req)) throw new AppError(403, 'GM, owner or pilot required')

    const deleted = await db('exo_programs')
      .where({ id: req.params.programId, character_id: req.params.characterId })
      .delete()
    if (!deleted) throw new AppError(404, 'Program not found')

    res.json({ message: 'Program deleted' })
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
