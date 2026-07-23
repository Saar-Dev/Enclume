import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { multerUpload, uploadToMinio } from '../middleware/upload.js'
import { calcAttributeNA } from '../lib/charStats.js'
import { calcREA, getAdvantageModForAttr } from '../../../shared/polarisUtils.js'
import { removeTokens } from '../lib/tokenLifecycle.js'
import { getAdvantages } from '../services/advantageService.js'
import {
  SurfaceDocumentError,
  prepareSurfaceData,
} from '../../../shared/world/surfaceDocument.js'
import { compileSurfaceWorld } from '../../../shared/world/worldCompiler.js'
import {
  BATTLEMAP_DOCUMENT_REVISION_COLUMNS,
  hasRevisionConflict,
  parseExpectedRevision,
  syncBattlemapTextureUsage,
} from '../services/battlemapWorldPersistence.js'
import {
  cacheBattlemapWorldSnapshot,
  invalidateBattlemapWorld,
} from '../services/worldService.js'
import {
  executeBattlemapTokenMovement,
  planBattlemapTokenMovement,
} from '../services/worldMovementService.js'
import { getCharacterMovementBudget } from '../services/movementBudgetService.js'
import { evaluateBattlemapVisibility } from '../services/worldVisibilityService.js'
import {
  createCustomWorldEffectDefinition,
  createPropagatedWorldEffectInstances,
  createWorldEffectInstance,
  deleteWorldEffectInstance,
  listBattlemapWorldEffects,
  loadBattlemapRuntimeContext,
  setWorldFeatureState,
  updateWorldEffectInstance,
} from '../services/worldEffectService.js'
import {
  commandBattlemapElevator,
  listBattlemapElevators,
  reconcileBattlemapElevators,
} from '../services/worldElevatorService.js'
import { WS } from '../../../shared/events.js'

const router = Router({ mergeParams: true })

async function battlemapAndMember(battlemapId, userId) {
  const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: userId })
    .first()
  if (!member) throw new AppError(403, 'Access denied')
  return { battlemap, member }
}

function requireBattlemapGm(member) {
  if (member.role !== 'gm') throw new AppError(403, 'GM role required')
}

function runtimeInputError(error) {
  if (error instanceof TypeError || error instanceof RangeError) return new AppError(400, error.message)
  return error
}

function emitPassengerTokenPositions(req, campaignId, tokens = []) {
  const unique = new Map(tokens.map(token => [token.id, token]))
  for (const token of unique.values()) {
    req.app.get('io').to(campaignId).emit(WS.TOKEN_MOVED, {
      tokenId: token.id,
      pos_x: token.pos_x,
      pos_y: token.pos_y,
      pos_z: token.pos_z,
      position_space: token.position_space,
      updated_at: token.updated_at,
      worldMovement: { kind: 'elevator-passenger' },
    })
  }
}

function emitElevatorRuntime(req, battlemap, runtime, kind = 'elevator-clock') {
  if (!runtime?.changed) return
  req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
    battlemapId: battlemap.id,
    runtimeRevision: runtime.runtimeRevision,
    kind,
  })
  emitPassengerTokenPositions(req, battlemap.campaign_id, runtime.passengerTokens)
}

// GET /api/campaigns/:id/battlemaps — liste des cartes
router.get('/', requireAuth, async (req, res) => {
  const member = await db('campaign_members')
    .where({ campaign_id: req.params.id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const battlemaps = await db('battlemaps')
    .where({ campaign_id: req.params.id })
    .select(
      'id', 'name', 'folder', 'image_url', 'grid_size', 'grid_enabled', 'scale_label',
      'world_revision', 'surface_revision', 'voxel_revision', 'created_at',
    )
    .orderBy('created_at', 'asc')
  res.json({ battlemaps })
})

// POST /api/campaigns/:id/battlemaps — créer une carte
router.post('/',
  requireAuth,
  requireRole('gm'),
  multerUpload.single('image'),
  uploadToMinio('battlemaps'),
  async (req, res) => {
    const { name, folder, scale_label, grid_size, grid_enabled } = req.body
    if (!name) throw new AppError(400, 'Battlemap name is required')

    const [battlemap] = await db('battlemaps')
      .insert({
        campaign_id: req.params.id,
        name,
        folder: folder || null,
        scale_label: scale_label || '1,5m',
        grid_size: grid_size || 64,
        grid_enabled: grid_enabled !== undefined ? grid_enabled : true,
        image_url: req.file ? req.file.url : null,
      })
      .returning('*')

    res.status(201).json({ battlemap })
  }
)

// GET /api/battlemaps/:id/combat-ini — INI (REA) preview pour CombatRosterWindow
// Calcule base_ini de chaque token sans toucher à la DB combat — lecture seule.
router.get('/:id/combat-ini', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const tokens = await db('tokens').where({ battlemap_id: req.params.id })
  const iniPreview = []
  for (const token of tokens) {
    let base_ini = 0
    try {
      const cs = await db('char_sheet').where({ character_id: token.character_id }).first()
      if (cs) {
        const [attrs, archetype, advantages] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: cs.id }),
          db('char_archetype').where({ char_sheet_id: cs.id }).first(),
          getAdvantages(cs.id),
        ])
        const genotypeRow = archetype?.genotype_id
          ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
          : null
        base_ini = calcREA(
          calcAttributeNA(attrs, 'ADA', genotypeRow),
          calcAttributeNA(attrs, 'PER', genotypeRow),
          getAdvantageModForAttr(advantages, 'reaction')
        )
      }
    } catch (_) {}
    iniPreview.push({ token_id: token.id, base_ini })
  }
  res.json({ iniPreview })
})

// GET /api/battlemaps/:id/combat-equipment — équipement arme+armure par token (CombatRosterWindow)
const WEAPON_SLOTS_SET = new Set(['MG', 'MD', '2M', 'Tr'])
const NON_ARMOR_SLOTS  = new Set(['MG', 'MD', '2M', 'Tr', 'D', 'Ce'])

router.get('/:id/combat-equipment', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  const tokens = await db('tokens').where({ battlemap_id: req.params.id })
  const equipment = {}

  for (const token of tokens) {
    if (!token.character_id) continue

    // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : lit char_inventory_slots au lieu d'une égalité stricte/
    // exclusion sur char_inventory.slot — composite-safe (un futur objet occupant à la fois une main
    // et une localisation, ex. bouclier, apparaîtra correctement dans les deux listes ci-dessous).
    const [weaponRows, armorRows, naturalWeaponRows] = await Promise.all([
      db('char_inventory_slots as cis')
        .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
        .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where('char_inventory.character_id', token.character_id)
        .whereIn('cis.slot_code', ['MG', 'MD', '2M', 'Tr'])
        .select(
          'char_inventory.id as inv_id', 'ref_equipment.name', 'cis.slot_code as slot', 'ref_equipment.fire_mode as ref_fire_mode',
          'char_inventory.ammo_remaining', 'ref_equipment.ammo_count as ref_ammo_count', 'ref_equipment.caliber as ref_caliber',
          // Lunette de visée (docs/PLAN_MODING_PHASEB.md Groupe 2) — même sous-requête que
          // inventoryService.getInventory (fenêtre PJ), fenêtre MJ batchée par token (pas de N+1).
          db.raw(`(
            SELECT re2.bonus::int FROM char_inventory_mods cim2
            JOIN ref_equipment re2 ON re2.id = cim2.equipment_id
            WHERE cim2.weapon_inv_id = char_inventory.id
              AND re2.mod_slot = 'optique' AND re2.mod_requires_aim = true
            LIMIT 1
          ) as lunette_niveau`),
          // Compétence liée à l'arme (COM20) — même sous-requête que inventoryService.getInventory.
          db.raw(`(
            SELECT rs.label FROM ref_equipment_skill_assoc rea
            JOIN ref_skills rs ON rs.id = rea.skill_id
            WHERE rea.item_id = char_inventory.equipment_id
            LIMIT 1
          ) as skill_label`),
        ),

      db('char_inventory')
        .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where('char_inventory.character_id', token.character_id)
        .where('ref_equipment.family', 'Protections')
        .whereExists(function () {
          this.select(1).from('char_inventory_slots as cis')
            .whereRaw('cis.char_inventory_id = char_inventory.id')
            .whereNotIn('cis.slot_code', ['MG', 'MD', '2M', 'Tr', 'D', 'Ce'])
        })
        .select('char_inventory.id as inv_id', 'ref_equipment.name', 'ref_equipment.location'),

      // Armes naturelles actives (mutations) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Bridge
      // character_id → char_sheet.id, contrairement à char_inventory qui a directement character_id.
      db('char_mutations as cm')
        .join('char_sheet as cs', 'cs.id', 'cm.char_sheet_id')
        .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
        .where('cs.character_id', token.character_id)
        .where('cm.status', 'active')
        .whereNotNull('rm.natural_weapon_formula')
        .select('cm.id', 'rm.name', 'rm.natural_weapon_formula', 'rm.natural_weapon_requires_grapple'),
    ])

    const weaponMg = weaponRows.find(w => w.slot === 'MG') ?? null
    const weaponMd = weaponRows.find(w => w.slot === 'MD') ?? null

    equipment[token.id] = {
      characterId:    token.character_id,
      weapon:         weaponMg ?? weaponMd ?? weaponRows[0] ?? null,
      weaponMg,
      weaponMd,
      armorPieces:    armorRows,
      naturalWeapons: naturalWeaponRows,
    }
  }

  res.json({ equipment })
})

// GET /api/battlemaps/:id/world-snapshot — monde physique compilé et immuable
router.get('/:id/world-snapshot', requireAuth, async (req, res, next) => {
  try {
    const { battlemap } = await battlemapAndMember(req.params.id, req.user.id)
    const elevatorRuntime = await reconcileBattlemapElevators({ battlemapId: battlemap.id })
    const context = await loadBattlemapRuntimeContext(elevatorRuntime.battlemap)
    emitElevatorRuntime(req, battlemap, elevatorRuntime)
    res.json({ snapshot: context.snapshot, runtimeRevision: context.runtimeRevision })
  } catch (error) {
    next(runtimeInputError(error))
  }
})

// POST /api/battlemaps/:id/world-path-preview — prévisualisation sur la physique serveur.
// Le budget reçu sert uniquement à l'éditeur/preview. Un flux de jeu doit appeler le service avec
// un authorizedBudgetM calculé côté serveur depuis les règles de l'acteur.
router.post('/:id/world-path-preview', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
      .first()
    if (!member) throw new AppError(403, 'Access denied')

    const { token_id, destination, budget_m } = req.body
    const token = await db('tokens')
      .where({ id: token_id, battlemap_id: req.params.id })
      .first()
    if (!token) throw new AppError(404, 'Token not found on this battlemap')
    if (token.position_space !== 'world-feet') {
      throw new AppError(409, 'Legacy token positions are not converted to the new world engine')
    }

    let budgetM
    let budgetAuthority
    if (token.character_id) {
      const budget = await getCharacterMovementBudget(token.character_id, 'max')
      budgetM = budget.budgetM
      budgetAuthority = 'character-max-server'
    } else {
      if (member.role !== 'gm') throw new AppError(403, 'GM role required for a free preview')
      budgetM = Number(budget_m)
      if (!Number.isFinite(budgetM) || budgetM < 0) {
        throw new AppError(400, 'budget_m must be a non-negative number')
      }
      budgetAuthority = 'gm-preview'
    }

    if (member.role !== 'gm') {
      const character = token.character_id
        ? await db('characters').where({ id: token.character_id }).first()
        : null
      if (character?.user_id !== req.user.id) throw new AppError(403, 'You do not own this token')
    }

    let result
    try {
      result = await planBattlemapTokenMovement({
        battlemap,
        token,
        destination,
        authorizedBudgetM: budgetM,
      })
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw new AppError(400, error.message)
      }
      throw error
    }
    emitElevatorRuntime(req, battlemap, result.elevatorRuntime)

    res.json({
      result,
      budgetAuthority,
      authorizedBudgetM: budgetM,
      coordinateSpace: 'world-feet',
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/battlemaps/:id/world-move — déplacement de jeu autoritaire.
// Le client choisit une allure, jamais un budget numérique ni un chemin imposé.
router.post('/:id/world-move', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')
    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
      .first()
    if (!member) throw new AppError(403, 'Access denied')

    const { token_id, destination, gait = 'moyenne' } = req.body
    const token = await db('tokens')
      .where({ id: token_id, battlemap_id: req.params.id })
      .first()
    if (!token) throw new AppError(404, 'Token not found on this battlemap')
    if (!token.character_id) throw new AppError(400, 'A character token is required for game movement')
    if (token.position_space !== 'world-feet') {
      throw new AppError(409, 'Legacy token positions are not converted to the new world engine')
    }
    if (member.role !== 'gm') {
      const character = await db('characters').where({ id: token.character_id }).first()
      if (character?.user_id !== req.user.id) throw new AppError(403, 'You do not own this token')
    }

    let budget
    try {
      budget = await getCharacterMovementBudget(token.character_id, gait)
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw new AppError(400, error.message)
      }
      throw error
    }

    const outcome = await executeBattlemapTokenMovement({
      battlemapId: req.params.id,
      tokenId: token.id,
      destination,
      authorizedBudgetM: budget.budgetM,
    })
    emitElevatorRuntime(req, battlemap, outcome.elevatorRuntime)
    if (outcome.status === 'unreachable') throw new AppError(409, 'Destination unreachable')
    if (outcome.status === 'legacy-position') {
      throw new AppError(409, 'Legacy token positions are not converted to the new world engine')
    }
    if (outcome.status === 'battlemap-not-found' || outcome.status === 'token-not-found') {
      throw new AppError(409, 'World state changed before movement resolution')
    }

    if (outcome.moved) {
      req.app.get('io').to(battlemap.campaign_id).emit(WS.TOKEN_MOVED, {
        tokenId: outcome.token.id,
        pos_x: outcome.token.pos_x,
        pos_y: outcome.token.pos_y,
        pos_z: outcome.token.pos_z,
        position_space: outcome.token.position_space,
        updated_at: outcome.token.updated_at,
        worldMovement: {
          pathId: outcome.result.plan.pathId,
          worldRevision: outcome.result.worldRevision,
          runtimeRevision: outcome.runtimeRevision,
          spentM: outcome.result.plan.spentM,
          stopReason: outcome.result.plan.stopReason,
        },
      })
    }

    res.json({
      outcome,
      budget,
      coordinateSpace: 'world-feet',
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/battlemaps/:id/world-visibility — LOS, couverture et interposition sur le snapshot.
router.post('/:id/world-visibility', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')
    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
      .first()
    if (!member) throw new AppError(403, 'Access denied')

    const { source_token_id, target_token_id, source_posture, target_posture } = req.body
    const [sourceToken, targetToken] = await Promise.all([
      db('tokens').where({ id: source_token_id, battlemap_id: battlemap.id }).first(),
      db('tokens').where({ id: target_token_id, battlemap_id: battlemap.id }).first(),
    ])
    if (!sourceToken || !targetToken) throw new AppError(404, 'Source or target token not found')
    if (member.role !== 'gm') {
      const character = sourceToken.character_id
        ? await db('characters').where({ id: sourceToken.character_id }).first()
        : null
      if (character?.user_id !== req.user.id) throw new AppError(403, 'You do not own the source token')
    }

    let visibility
    try {
      visibility = await evaluateBattlemapVisibility({
        battlemap,
        sourceToken,
        targetToken,
        sourceProfile: { posture: source_posture },
        targetProfile: { posture: target_posture },
      })
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw new AppError(400, error.message)
      }
      throw error
    }
    if (visibility.status === 'legacy-position') {
      throw new AppError(409, 'Legacy token positions are not converted to the new world engine')
    }
    emitElevatorRuntime(req, battlemap, visibility.elevatorRuntime)
    res.json({ visibility, coordinateSpace: 'world-feet' })
  } catch (error) {
    next(error)
  }
})

// Une lecture réconcilie l'horloge durable : la cabine et ses passagers continuent donc leur
// trajet même après un redémarrage, sans dépendre d'un timer en mémoire.
router.get('/:id/world-elevators', requireAuth, async (req, res, next) => {
  try {
    const { battlemap } = await battlemapAndMember(req.params.id, req.user.id)
    const worldElevators = await listBattlemapElevators({ battlemapId: battlemap.id })
    emitElevatorRuntime(req, battlemap, worldElevators)
    res.json({ worldElevators })
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.post('/:id/world-elevators/:elevatorId/commands', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    const type = String(req.body?.type || '')
    if (type !== 'request' && type !== 'use') requireBattlemapGm(member)
    if (type === 'use') {
      const tokenId = String(req.body?.tokenId || '')
      if (!tokenId) throw new AppError(400, 'A token is required to use the elevator')
      const token = await db('tokens')
        .where({ id: tokenId, battlemap_id: battlemap.id })
        .first()
      if (!token) throw new AppError(404, 'Token not found on this battlemap')
      if (member.role !== 'gm') {
        const character = token.character_id
          ? await db('characters').where({ id: token.character_id }).first()
          : null
        if (character?.user_id !== req.user.id) throw new AppError(403, 'You do not own this token')
      }
    }
    const outcome = await commandBattlemapElevator({
      battlemapId: battlemap.id,
      elevatorId: req.params.elevatorId,
      command: { ...req.body, type },
      userId: req.user.id,
    })
    emitElevatorRuntime(req, battlemap, outcome, `elevator-${type}`)
    res.json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

// Registre et instances runtime. Les membres lisent ; seul le MJ modifie.
router.get('/:id/world-effects', requireAuth, async (req, res, next) => {
  try {
    const { battlemap } = await battlemapAndMember(req.params.id, req.user.id)
    res.json({ worldEffects: await listBattlemapWorldEffects(battlemap) })
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.post('/:id/world-effects/definitions', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const definition = await createCustomWorldEffectDefinition({
      campaignId: battlemap.campaign_id,
      input: req.body,
      userId: req.user.id,
    })
    res.status(201).json({ definition })
  } catch (error) {
    if (error?.code === '23505') return next(new AppError(409, 'Effect key already exists'))
    next(runtimeInputError(error))
  }
})

router.post('/:id/world-effects/instances', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const outcome = await createWorldEffectInstance({
      battlemapId: battlemap.id,
      input: req.body,
      userId: req.user.id,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'effect-created',
    })
    res.status(201).json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.patch('/:id/world-effects/instances/:instanceId', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const outcome = await updateWorldEffectInstance({
      battlemapId: battlemap.id,
      instanceId: req.params.instanceId,
      patch: req.body,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'effect-updated',
    })
    res.json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.delete('/:id/world-effects/instances/:instanceId', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const outcome = await deleteWorldEffectInstance({
      battlemapId: battlemap.id,
      instanceId: req.params.instanceId,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'effect-deleted',
    })
    res.json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.post('/:id/world-effects/propagate', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const outcome = await createPropagatedWorldEffectInstances({
      battlemapId: battlemap.id,
      definitionKey: req.body.definitionKey,
      originCompartmentId: req.body.originCompartmentId,
      channel: req.body.channel,
      intensity: req.body.intensity,
      attenuation: req.body.attenuation,
      source: req.body.source,
      userId: req.user.id,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'effect-propagated',
    })
    res.status(201).json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.patch('/:id/world-features/:featureId/state', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const outcome = await setWorldFeatureState({
      battlemapId: battlemap.id,
      featureId: req.params.featureId,
      state: req.body.state,
      userId: req.user.id,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'feature-state',
      featureId: req.params.featureId,
    })
    res.json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.patch('/:id/world-windows/:featureId/state', requireAuth, async (req, res, next) => {
  try {
    const { battlemap } = await battlemapAndMember(req.params.id, req.user.id)
    const connectors = Object.values(battlemap.surface_data?.connectors || {})
    const connector = connectors.find(item => String(item?.worldId) === String(req.params.featureId))
    if (!connector || connector.type !== 'screen-window') throw new AppError(404, 'Fenêtre écran inconnue')
    const requested = String(req.body?.state || '')
    const allowedStates = Array.isArray(connector.allowedStates) ? connector.allowedStates : ['transparent']
    if (!allowedStates.includes(requested)) throw new AppError(400, 'État de fenêtre non autorisé')
    const outcome = await setWorldFeatureState({
      battlemapId: battlemap.id,
      featureId: req.params.featureId,
      state: { state: requested },
      userId: req.user.id,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'feature-state',
      featureId: req.params.featureId,
    })
    res.json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

router.patch('/:id/world-hatches/:featureId/state', requireAuth, async (req, res, next) => {
  try {
    const { battlemap, member } = await battlemapAndMember(req.params.id, req.user.id)
    requireBattlemapGm(member)
    const connectors = Object.values(battlemap.surface_data?.connectors || {})
    const connector = connectors.find(item => String(item?.worldId) === String(req.params.featureId))
    if (!connector || connector.type !== 'hatch') throw new AppError(404, 'Trappe inconnue')
    const requested = String(req.body?.state || '')
    const allowedStates = Array.isArray(connector.allowedStates)
      ? connector.allowedStates
      : ['closed', 'open', 'locked']
    if (!allowedStates.includes(requested)) throw new AppError(400, 'État de trappe non autorisé')
    const outcome = await setWorldFeatureState({
      battlemapId: battlemap.id,
      featureId: req.params.featureId,
      state: { state: requested },
      userId: req.user.id,
    })
    req.app.get('io').to(battlemap.campaign_id).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: battlemap.id, runtimeRevision: outcome.runtimeRevision, kind: 'feature-state',
      featureId: req.params.featureId,
    })
    res.json(outcome)
  } catch (error) {
    next(runtimeInputError(error))
  }
})

// GET /api/battlemaps/:id — carte complète avec tokens
router.get('/:id', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps')
    .where({ 'battlemaps.id': req.params.id })
    .first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  // Vérifier que l'utilisateur est membre de la campagne
  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'Access denied')

  // Tokens visibles selon le rôle — JOIN pour user_color toujours à jour
  let tokensQuery = db('tokens')
    .leftJoin('characters', 'tokens.character_id', 'characters.id')
    .leftJoin('users', 'characters.user_id', 'users.id')
    .where({ 'tokens.battlemap_id': req.params.id })
  if (member.role !== 'gm') {
    tokensQuery = tokensQuery
      .where({ 'tokens.visible_to_players': true })
      .whereNot({ 'tokens.layer': 'gm' })
  }
  const tokens = await tokensQuery.select('tokens.*', 'users.color as user_color')

  // Enrichir chaque token avec ses statuts actifs
  const tokenIds = tokens.map(t => t.id)
  let statusMap = {}
  if (tokenIds.length > 0) {
    const allStatuses = await db('token_statuses')
      .whereIn('token_id', tokenIds)
      .select('token_id', 'status_code')
    allStatuses.forEach(s => {
      if (!statusMap[s.token_id]) statusMap[s.token_id] = []
      statusMap[s.token_id].push(s.status_code)
    })
  }
  const tokensWithStatuses = tokens.map(t => ({ ...t, statuses: statusMap[t.id] || [] }))

  res.json({ battlemap, tokens: tokensWithStatuses })
})

// PUT /api/battlemaps/:id — modifier une carte
router.put('/:id',
  requireAuth,
  multerUpload.single('image'),
  uploadToMinio('battlemaps'),
  async (req, res) => {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    const { name, folder, scale_label, grid_size, grid_enabled, grid_opacity, viewport_state } = req.body

    const updates = {}
    if (name !== undefined) updates.name = name
    if (folder !== undefined) updates.folder = folder
    if (scale_label !== undefined) updates.scale_label = scale_label
    if (grid_size !== undefined) updates.grid_size = grid_size
    if (grid_enabled !== undefined) updates.grid_enabled = grid_enabled
    if (grid_opacity !== undefined) updates.grid_opacity = grid_opacity
    if (viewport_state !== undefined) updates.viewport_state = viewport_state
    if (req.file) updates.image_url = req.file.url

    // updated_at systématique sur tout PUT
    updates.updated_at = db.fn.now()

    const [updated] = await db('battlemaps')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*')

    res.json({ battlemap: updated })
  }
)

// DELETE /api/battlemaps/:id — supprimer une carte
router.delete('/:id', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  // Supprimer d'abord les tokens de cette carte (nettoyage Redis + broadcast TOKEN_DELETED) —
  // sans quoi le CASCADE SQL efface les lignes mais laisse la collision map Redis et les clients
  // connectés désynchronisés (même trou que la suppression de character, tokenLifecycle.js)
  const tokens = await db('tokens')
    .select('id', 'battlemap_id', 'pos_x', 'pos_y', 'pos_z', 'layer')
    .where({ battlemap_id: req.params.id })
  if (tokens.length) {
    const io = req.app.get('io')
    await removeTokens(io, tokens, battlemap.campaign_id)
  }

  await db('battlemaps').where({ id: req.params.id }).delete()
  invalidateBattlemapWorld(req.params.id)

  // Fallback : si c'était la carte d'accueil, on assigne la plus ancienne restante
  const campaign = await db('campaigns').where({ id: battlemap.campaign_id }).first()
  if (campaign.default_battlemap_id === req.params.id) {
    const nextMap = await db('battlemaps')
      .where({ campaign_id: battlemap.campaign_id })
      .orderBy('created_at', 'asc')
      .first()
    await db('campaigns')
      .where({ id: battlemap.campaign_id })
      .update({ default_battlemap_id: nextMap ? nextMap.id : null })
  }

  res.json({ success: true })
})

// PUT /api/battlemaps/:id/voxels — mettre à jour les données voxel
router.put('/:id/voxels', requireAuth, async (req, res, next) => {
  try {
    const { voxel_data, voxel_revision } = req.body
    if (!voxel_data || typeof voxel_data !== 'object' || Array.isArray(voxel_data)) {
      throw new AppError(400, 'voxel_data must be an object')
    }

    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    const expectedRevision = parseExpectedRevision(voxel_revision, 'voxel_revision')
    let updated
    await db.transaction(async trx => {
      const current = await trx('battlemaps').where({ id: req.params.id }).forUpdate().first()
      if (!current) throw new AppError(404, 'Battlemap not found')
      if (hasRevisionConflict(current.voxel_revision, expectedRevision)) {
        throw new AppError(409, 'Voxel data changed since the editor loaded it')
      }

      ;[updated] = await trx('battlemaps')
        .where({ id: req.params.id })
        .update({
          voxel_data: JSON.stringify(voxel_data),
          voxel_revision: Number(current.voxel_revision || 0) + 1,
          world_revision: Number(current.world_revision || 0) + 1,
          updated_at: trx.fn.now(),
        })
        .returning(BATTLEMAP_DOCUMENT_REVISION_COLUMNS)

      await syncBattlemapTextureUsage(
        trx,
        req.params.id,
        voxel_data,
        current.surface_data || {},
      )
    })

    invalidateBattlemapWorld(req.params.id)
    res.json({ ok: true, ...updated })
  } catch (err) {
    next(err)
  }
})

// PUT /api/battlemaps/:id/surface — mettre à jour les surfaces du nouveau moteur
router.put('/:id/surface', requireAuth, async (req, res, next) => {
  try {
    const { surface_data, surface_revision } = req.body
    if (!surface_data || typeof surface_data !== 'object' || Array.isArray(surface_data)) {
      throw new AppError(400, 'surface_data must be an object')
    }

    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    let prepared
    try {
      prepared = prepareSurfaceData(surface_data, { battlemapId: req.params.id })
    } catch (error) {
      if (error instanceof SurfaceDocumentError) throw new AppError(400, error.message)
      throw error
    }

    const expectedRevision = parseExpectedRevision(surface_revision, 'surface_revision')
    let updated
    let snapshot
    await db.transaction(async trx => {
      const current = await trx('battlemaps').where({ id: req.params.id }).forUpdate().first()
      if (!current) throw new AppError(404, 'Battlemap not found')
      if (hasRevisionConflict(current.surface_revision, expectedRevision)) {
        throw new AppError(409, 'Surface data changed since the editor loaded it')
      }

      const nextWorldRevision = Number(current.world_revision || 0) + 1
      snapshot = compileSurfaceWorld({
        battlemapId: req.params.id,
        worldRevision: nextWorldRevision,
        surfaceData: prepared.surfaceData,
      })

      ;[updated] = await trx('battlemaps')
        .where({ id: req.params.id })
        .update({
          surface_data: JSON.stringify(prepared.surfaceData),
          surface_revision: Number(current.surface_revision || 0) + 1,
          world_revision: nextWorldRevision,
          updated_at: trx.fn.now(),
        })
        .returning(BATTLEMAP_DOCUMENT_REVISION_COLUMNS)

      await syncBattlemapTextureUsage(
        trx,
        req.params.id,
        current.voxel_data || {},
        prepared.surfaceData,
      )
    })

    cacheBattlemapWorldSnapshot(updated, snapshot)
    res.json({ ok: true, ...updated, surface_data: prepared.surfaceData })
  } catch (err) {
    next(err)
  }
})

// POST /api/battlemaps/:id/duplicate — dupliquer une carte
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap not found')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
    .first()
  if (!member) throw new AppError(403, 'GM only')

  const duplicatedId = randomUUID()
  const duplicatedSurface = prepareSurfaceData(battlemap.surface_data || {}, {
    battlemapId: duplicatedId,
    reseedWorldIds: true,
  }).surfaceData
  let duplicated
  await db.transaction(async trx => {
    ;[duplicated] = await trx('battlemaps')
      .insert({
        id: duplicatedId,
        campaign_id: battlemap.campaign_id,
        name: `${battlemap.name} (copie)`,
        folder: battlemap.folder,
        scale_label: battlemap.scale_label,
        grid_size: battlemap.grid_size,
        grid_enabled: battlemap.grid_enabled,
        grid_opacity: battlemap.grid_opacity,
        voxel_data: battlemap.voxel_data ? JSON.stringify(battlemap.voxel_data) : null,
        surface_data: JSON.stringify(duplicatedSurface),
        // image_url et cover_image_url non copiés — la carte est nouvelle
      })
      .returning('*')

    await syncBattlemapTextureUsage(
      trx,
      duplicatedId,
      battlemap.voxel_data || {},
      duplicatedSurface,
    )
  })

  res.status(201).json({ battlemap: duplicated })
})

// POST /api/battlemaps/:id/editor-lock — acquérir le lock éditeur (GM uniquement)
router.post('/:id/editor-lock', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    // Vérifier si le lock est actif par quelqu'un d'autre
    const isLocked = battlemap.editor_locked_by
      && battlemap.editor_locked_by !== req.user.id
      && battlemap.editor_locked_until > new Date()
    if (isLocked) {
      return res.status(423).json({ lockedBy: battlemap.editor_locked_by })
    }

    const lockedUntil = new Date(Date.now() + 60 * 1000)
    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_by: req.user.id,
      editor_locked_until: lockedUntil,
    })
    res.json({ ok: true, lockedUntil })
  } catch (err) { next(err) }
})

// DELETE /api/battlemaps/:id/editor-lock — libérer le lock
router.delete('/:id/editor-lock', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    // Seul le titulaire du lock peut le libérer
    if (battlemap.editor_locked_by !== req.user.id) {
      throw new AppError(403, 'Not lock owner')
    }

    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_by: null,
      editor_locked_until: null,
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// POST /api/battlemaps/:id/editor-heartbeat — renouveler le lock (toutes les 30s)
router.post('/:id/editor-heartbeat', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    // Seul le titulaire peut renouveler
    if (battlemap.editor_locked_by !== req.user.id) {
      throw new AppError(403, 'Not lock owner')
    }

    const lockedUntil = new Date(Date.now() + 60 * 1000)
    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_until: lockedUntil,
    })
    res.json({ ok: true, lockedUntil })
  } catch (err) { next(err) }
})

export default router
