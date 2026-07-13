import { Router } from 'express'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { bumpBattlemapRuntimeRevision } from '../services/worldRuntimeService.js'

// mergeParams : true — nécessaire pour accéder à req.params.id (battlemap_id)
// quand monté sous /api/battlemaps/:id/entities
const router = Router({ mergeParams: true })

function entityPlacementMode(blueprint) {
  const mode = blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
  return ['free', 'wall', 'connector'].includes(mode) ? mode : 'free'
}

function plainEntityState(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function assertWallPlacementState(blueprint, state) {
  if (entityPlacementMode(blueprint) !== 'wall') return
  const placement = plainEntityState(state).placement
  if (!placement || placement.mode !== 'wall' || !placement.wallId || !placement.wallAxis || !placement.wallFace) {
    throw new AppError(400, 'Un objet mural doit être ancré à un mur valide')
  }
}

// ─── Helper — vérification membre campagne ────────────────────────────────────
// Retourne le membre ou lève une AppError.
async function getMember(battlemapId, userId) {
  const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
  if (!battlemap) throw new AppError(404, 'Battlemap introuvable')

  const member = await db('campaign_members')
    .where({ campaign_id: battlemap.campaign_id, user_id: userId })
    .first()
  if (!member) throw new AppError(403, 'Accès refusé')

  return { battlemap, member }
}

// ─── GET /api/battlemaps/:id/entities ────────────────────────────────────────
// Liste les entités d'une battlemap avec leur blueprint embarqué (JOIN).
// Les entités gm_only sont exclues pour les non-GM.
// Retourne : { entities: [{ ...instance, blueprint: { ...blueprint } }] }
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { member } = await getMember(req.params.id, req.user.id)
    const isGm = member.role === 'gm'

    let query = db('entities')
      .where({ 'entities.battlemap_id': req.params.id })
      .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
      .select(
        'entities.*',
        // Blueprint embarqué — toutes les colonnes préfixées bp_
        'entity_blueprints.label as bp_label',
        'entity_blueprints.glb_url as bp_glb_url',
        'entity_blueprints.geometry as bp_geometry',
        'entity_blueprints.states as bp_states',
        'entity_blueprints.interactions as bp_interactions',
        'entity_blueprints.deprecated as bp_deprecated',
        'entity_blueprints.created_by as bp_created_by',
        'entity_blueprints.pack_id as bp_pack_id',
      )
      .orderBy('entities.created_at', 'asc')

    // Filtrer les entités GM-only pour les joueurs
    if (!isGm) {
      query = query.where({ 'entities.gm_only': false })
    }

    const rows = await query

    // Restructurer : aplatir les colonnes bp_* en un objet blueprint imbriqué
    const entities = rows.map(row => {
      const {
        bp_label, bp_glb_url, bp_geometry, bp_states,
        bp_interactions, bp_deprecated, bp_created_by, bp_pack_id,
        ...instance
      } = row
      return {
        ...instance,
        blueprint: {
          id: instance.blueprint_id,
          label: bp_label,
          glb_url: bp_glb_url,
          geometry: bp_geometry,
          states: bp_states,
          interactions: bp_interactions,
          deprecated: bp_deprecated,
          created_by: bp_created_by,
          pack_id: bp_pack_id,
        },
      }
    })

    res.json({ entities })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/battlemaps/:id/entities ───────────────────────────────────────
// Poser une entité sur une battlemap. GM uniquement.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { member } = await getMember(req.params.id, req.user.id)
    if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')

    const {
      blueprint_id, pos_x, pos_y, pos_z, r,
      gm_only, label_override, state,
    } = req.body

    if (!blueprint_id) throw new AppError(400, 'blueprint_id est obligatoire')
    if (pos_x == null || pos_y == null || pos_z == null) {
      throw new AppError(400, 'pos_x, pos_y, pos_z sont obligatoires')
    }

    // Vérifier que le blueprint existe
    const blueprint = await db('entity_blueprints').where({ id: blueprint_id }).first()
    if (!blueprint) throw new AppError(404, 'Blueprint introuvable')
    const placementMode = entityPlacementMode(blueprint)
    if (placementMode === 'connector') {
      throw new AppError(400, 'Ce modèle est un connecteur de salle et ne peut pas être posé comme objet 3D libre')
    }
    const initialState = plainEntityState(state)
    assertWallPlacementState(blueprint, initialState)

    const [entity] = await db('entities')
      .insert({
        battlemap_id: req.params.id,
        blueprint_id,
        pos_x,
        pos_y,     // profondeur (axe Z Three.js) — PE14
        pos_z,     // altitude  (axe Y Three.js) — PE14
        r: r ?? 0,
        gm_only: gm_only ?? false,
        label_override: label_override || null,
        current_state_id: 0,
        interaction_overrides: JSON.stringify({}),
        disabled_interactions: db.raw('ARRAY[]::TEXT[]'),
        state: JSON.stringify(initialState),
      })
      .returning('*')
    await bumpBattlemapRuntimeRevision(req.params.id)

    // L'occupation dynamique sera relue depuis PostgreSQL par le moteur monde.

    // Retourner l'instance avec son blueprint embarqué
    res.status(201).json({
      entity: { ...entity, blueprint },
    })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/entities/:entityId ─────────────────────────────────────────────
// Modifier une instance (état, position, overrides, notes GM).
// GM uniquement.
// Monté sous /api/entities/:entityId via le second montage dans index.js.
router.put('/:entityId', requireAuth, async (req, res, next) => {
  try {
    const entity = await db('entities').where({ id: req.params.entityId }).first()
    if (!entity) throw new AppError(404, 'Entité introuvable')

    const { member } = await getMember(entity.battlemap_id, req.user.id)
    if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')

    // Lire le blueprint pour valider le mode de placement et retourner la ressource complète.
    const blueprint = await db('entity_blueprints').where({ id: entity.blueprint_id }).first()

    const {
      pos_x, pos_y, pos_z, r,
      current_state_id, gm_only, label_override,
      interaction_overrides, disabled_interactions,
      state, notes_gm,
    } = req.body

    if (state !== undefined || pos_x !== undefined || pos_y !== undefined || pos_z !== undefined || r !== undefined) {
      assertWallPlacementState(blueprint, state !== undefined ? state : entity.state)
    }

    const updates = {}
    if (pos_x !== undefined) updates.pos_x = pos_x
    if (pos_y !== undefined) updates.pos_y = pos_y   // profondeur (Z Three.js) — PE14
    if (pos_z !== undefined) updates.pos_z = pos_z   // altitude  (Y Three.js) — PE14
    if (r !== undefined) updates.r = r
    if (current_state_id !== undefined) updates.current_state_id = current_state_id
    if (gm_only !== undefined) updates.gm_only = gm_only
    if (label_override !== undefined) updates.label_override = label_override || null
    if (interaction_overrides !== undefined) updates.interaction_overrides = JSON.stringify(interaction_overrides)
    if (disabled_interactions !== undefined) updates.disabled_interactions = disabled_interactions
    if (state !== undefined) updates.state = JSON.stringify(state)
    if (notes_gm !== undefined) updates.notes_gm = notes_gm || null

    if (Object.keys(updates).length === 0) {
      return res.json({ entity: { ...entity, blueprint } })
    }

    // updated_at après le guard Object.keys — P13
    updates.updated_at = db.fn.now()

    const [updated] = await db('entities')
      .where({ id: req.params.entityId })
      .update(updates)
      .returning('*')
    await bumpBattlemapRuntimeRevision(entity.battlemap_id)

    res.json({ entity: { ...updated, blueprint } })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/entities/:entityId ──────────────────────────────────────────
// Supprimer une instance. GM uniquement.
router.delete('/:entityId', requireAuth, async (req, res, next) => {
  try {
    const entity = await db('entities').where({ id: req.params.entityId }).first()
    if (!entity) throw new AppError(404, 'Entité introuvable')

    const { member } = await getMember(entity.battlemap_id, req.user.id)
    if (member.role !== 'gm') throw new AppError(403, 'GM uniquement')

    // La suppression invalide la révision runtime ; aucun cache collision secondaire n'existe.

    await db('entities').where({ id: req.params.entityId }).delete()
    await bumpBattlemapRuntimeRevision(entity.battlemap_id)

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
