import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { getUserColor } from '../lib/socketUtils.js'
import { getMrTable, getModifier } from '../lib/mrTable.js'
import {
  calcSkillTotal, calcAttributeAN, calcAttributeNA,
  calcWoundPenalty, calcEncumbrancePenalty,
  ATTR_LABELS,
} from '../lib/charStats.js'
import { getMutationEffects } from '../services/mutationService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { measureBattlemapTokenEntityDistance } from '../services/worldSpatialQueryService.js'
import { executeBattlemapRigidPairMovement } from '../services/worldForcedMovementService.js'
import { bumpBattlemapRuntimeRevision } from '../services/worldRuntimeService.js'

// ─── Helper — résolution état entité après succès ─────────────────────────────
// Lit target_state_id de l'interaction, met à jour current_state_id en base,
// broadcaster ENTITY_UPDATED à toute la room,
// puis invalide la révision runtime dont dépendent collision, navigation et visibilité.
async function resolveEntityState(entityId, interactionId, campaignId, io) {
  try {
    const entity = await db('entities').where({ id: entityId }).first()
    if (!entity) return

    const blueprint = await db('entity_blueprints').where({ id: entity.blueprint_id }).first()
    if (!blueprint) return

    const interaction = (blueprint.interactions || []).find(i => i.id === interactionId)
    if (!interaction || interaction.target_state_id == null) return

    const [updated] = await db('entities')
      .where({ id: entityId })
      .update({
        current_state_id: interaction.target_state_id,
        updated_at: db.fn.now(),
      })
      .returning(['id', 'current_state_id', 'state', 'updated_at', 'pos_x', 'pos_y', 'pos_z', 'battlemap_id'])
    const runtimeRevision = await bumpBattlemapRuntimeRevision(updated.battlemap_id)

    io.to(campaignId).emit(WS.ENTITY_UPDATED, {
      entityId: updated.id,
      current_state_id: updated.current_state_id,
      state: updated.state,
      updated_at: updated.updated_at,
    })
    io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId: updated.battlemap_id,
      runtimeRevision,
      kind: 'entity-state',
    })
  } catch (err) {
    console.error('[WS] resolveEntityState error:', err.message)
  }
}

export function registerEntityHandlers(io, socket, { campaignId, user, isGm }, pendingEntityActions) {
  // ─── ENTITY:ACTION_REQUEST ─────────────────────────────────────────────
  // Payload : { requestId, characterId, entityId, interactionId, skillId }
  // skillTotal N'EST PAS reçu du client — le serveur calcule via charStats.js.
  // Timeout 60s — si le GM ne répond pas, refus automatique (PE12).
  socket.on(WS.ENTITY_ACTION_REQUEST, async ({ requestId, characterId, entityId, interactionId, skillId }) => {
    try {
      if (!campaignId) return
      if (!requestId || !characterId || !entityId || !interactionId) return

      // Validation 1 — le character appartient bien au joueur émetteur
      const character = await db('characters').where({ id: characterId }).first()
      if (!character || character.user_id !== user.id) {
        socket.emit('error', { message: 'Character non autorisé' })
        return
      }

      // Validation 2 — l'entité existe
      const entity = await db('entities').where({ id: entityId }).first()
      if (!entity) {
        socket.emit('error', { message: 'Entité introuvable' })
        return
      }

      // Validation 3 — l'interaction existe et n'est pas désactivée
      const blueprint = await db('entity_blueprints').where({ id: entity.blueprint_id }).first()
      if (!blueprint) return

      const interaction = (blueprint.interactions || []).find(i => i.id === interactionId)
      if (!interaction) {
        socket.emit('error', { message: 'Interaction introuvable' })
        return
      }
      if ((entity.disabled_interactions || []).includes(interactionId)) {
        socket.emit('error', { message: 'Interaction désactivée sur cette entité' })
        return
      }

      // Résolution difficulté effective (override instance si présent)
      const overrides = entity.interaction_overrides?.[interactionId] || {}
      const defaultDifficulty = overrides.difficulty_dc ?? interaction.difficulty_dc

      // Guard — pas de mécanique (skill_id ni attribute_id) → résolution directe sans GM
      if (!interaction.skill_id && !interaction.attribute_id) {
        await resolveEntityState(entityId, interactionId, campaignId, io)
        console.log(`[WS] entity:action_request direct (no skill) — ${user.username} → ${interaction.action_label}`)
        return
      }

      // Trouver le socket GM via socket.data.role (PE2 — fetchSockets expose socket.data)
      const roomSockets = await io.in(campaignId).fetchSockets()
      const gmSocket = roomSockets.find(s => s.data.role === 'gm')

      if (!gmSocket) {
        socket.emit(WS.ENTITY_ACTION_RESULT, {
          requestId, isApproved: false, reason: 'no_gm',
        })
        return
      }

      // Timeout 60s (PE12) — stocké dans la Map pour nettoyage à la résolution
      const timeoutHandle = setTimeout(() => {
        pendingEntityActions.delete(requestId)
        socket.emit(WS.ENTITY_ACTION_RESULT, {
          requestId, isApproved: false, reason: 'timeout',
        })
        console.log(`[WS] entity:action timeout — requestId: ${requestId}`)
      }, 60000)

      pendingEntityActions.set(requestId, {
        timeoutHandle,
        playerSocketId: socket.id,
        playerUserId: user.id,
        playerName: user.username,
        characterId,
        characterName: character.name,
        entityId,
        entityLabel: entity.label_override || blueprint.label,
        interactionId,
        interactionLabel: interaction.action_label,
        skillId,
        attributeId: interaction.attribute_id || null,
        defaultDifficulty,
        campaignId,
      })

      gmSocket.emit(WS.ENTITY_ACTION_PENDING, {
        requestId,
        playerName: user.username,
        characterName: character.name,
        entityLabel: entity.label_override || blueprint.label,
        interactionLabel: interaction.action_label,
        skillId,
        defaultDifficulty,
      })

      console.log(`[WS] entity:action_request — ${user.username} → ${interaction.action_label}`)
    } catch (err) {
      console.error('[WS] entity:action_request error:', err.message)
    }
  })

  // ─── ENTITY:ACTION_RESOLVE ─────────────────────────────────────────────
  // Le GM prend une décision sur une demande d'interaction.
  // Payload : { requestId, isApproved, autoSuccess, gmModifier }
  socket.on(WS.ENTITY_ACTION_RESOLVE, async ({ requestId, isApproved, autoSuccess, gmModifier = 0 }) => {
    try {
      if (!isGm) return
      if (!requestId) return

      const pending = pendingEntityActions.get(requestId)
      if (!pending) return

      // Nettoyer le timer et la Map (PE12)
      clearTimeout(pending.timeoutHandle)
      pendingEntityActions.delete(requestId)

      const roomSockets = await io.in(pending.campaignId).fetchSockets()
      const playerSocket = roomSockets.find(s => s.id === pending.playerSocketId)

      // ── Refus ──────────────────────────────────────────────────────────
      if (!isApproved) {
        if (playerSocket) {
          playerSocket.emit(WS.ENTITY_ACTION_RESULT, {
            requestId, isApproved: false, reason: 'refused',
          })
        }
        return
      }

      // ── Réussite automatique (sans jet) ───────────────────────────────
      if (autoSuccess) {
        const timestamp = new Date().toISOString()
        io.to(pending.campaignId).emit(WS.DICE_RESULT, {
          userId: pending.playerUserId,
          username: pending.playerName,
          color: '#5b8dee',
          formula: pending.skillId,
          rolls: [],
          total: null,
          type: 'auto',
          isCriticalSuccess: false,
          isCriticalFail: false,
          timestamp,
        })
        await resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)
        return
      }

      // ── Skill absent → succès automatique sans jet (S34-2) ────────────
      if (!pending.skillId) {
        await resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)
        return
      }

      // ── Jet de dés (1d20 + total serveur vs DC) ───────────────────────
      try {
        const { rolls, total: diceRoll, formula: normalizedFormula, seed } = await parseDice('1d20')

        let mechanicalTotal = 0
        let effectiveMalus = 0
        let formulaLabel = pending.skillId || pending.attributeId || '?'

        const sheet = pending.characterId
          ? await db('char_sheet').where({ character_id: pending.characterId }).first()
          : null

        if (sheet) {
          const [attrs, archetype, charSkillRow, refSkill, mutationEffects, settings] = await Promise.all([
            db('char_attributes').where({ char_sheet_id: sheet.id }),
            db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
            pending.skillId
              ? db('char_skills').where({ char_sheet_id: sheet.id, skill_id: pending.skillId }).first()
              : Promise.resolve(null),
            pending.skillId
              ? db('ref_skills').where({ id: pending.skillId }).first()
              : Promise.resolve(null),
            getMutationEffects(sheet.id),
            getCampaignSettings(db, pending.campaignId),
          ])

          const genotypeRow = archetype?.genotype_id
            ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
            : null

          if (pending.skillId && refSkill) {
            mechanicalTotal = calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow, mutationEffects)
            formulaLabel = refSkill.label || pending.skillId
          } else if (pending.attributeId) {
            mechanicalTotal = calcAttributeAN(attrs, pending.attributeId, genotypeRow, mutationEffects)
            formulaLabel = ATTR_LABELS[pending.attributeId] || pending.attributeId
          }

          // ── Malus effectif (blessures + encombrement) ──────────────────────
          try {
            const wounds = await db('character_wounds').where({ char_sheet_id: sheet.id })
            const woundPenalty = calcWoundPenalty(wounds)

            // FOR nette = calcAttributeNA (base + pc_modifier + génotype + mutations), corrige PI4
            const forValue = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)

            const invItems = await db('char_inventory')
              .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
              .where({ 'char_inventory.character_id': pending.characterId })
              .select('char_inventory.container', 'ref_equipment.weight as ref_weight', 'char_inventory.quantity')

            const totalWeight = invItems.reduce((sum, item) => {
              if (item.container === 'Coffre') return sum
              if (item.ref_weight == null) return sum
              return sum + item.ref_weight * item.quantity
            }, 0)

            const encumbrancePenalty = settings.encumbrance_enabled
              ? calcEncumbrancePenalty(totalWeight, forValue, settings.encumbrance_multiplier)
              : 0
            effectiveMalus = woundPenalty - encumbrancePenalty

            if (effectiveMalus < 0) console.log(`[DBG] entity:action_resolve — malus actif ${effectiveMalus} pour character ${pending.characterId}`)
          } catch (malusErr) {
            console.warn('[WS] entity:action_resolve — calcul malus échoué, fallback 0:', malusErr.message)
          }

        } else {
          console.warn(`[WS] entity:action_resolve — char_sheet introuvable pour character ${pending.characterId}, fallback total=0`)
          if (pending.skillId) formulaLabel = pending.skillId
          else if (pending.attributeId) formulaLabel = ATTR_LABELS[pending.attributeId] || pending.attributeId
        }

        const color = await getUserColor(db, pending.playerUserId)

        const totalDiffMod = pending.defaultDifficulty + gmModifier
        const chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
        const isSuccess = diceRoll <= chancesDeReussite
        const diffLabel = totalDiffMod >= 0 ? `+${totalDiffMod}` : `${totalDiffMod}`

        const breakdown = [
          { label: formulaLabel, value: mechanicalTotal, type: 'base' },
          ...(pending.defaultDifficulty !== 0 ? [{ label: 'Difficulté', value: pending.defaultDifficulty, type: pending.defaultDifficulty > 0 ? 'bonus' : 'malus' }] : []),
          ...(gmModifier !== 0 ? [{ label: 'Modificateur GM', value: gmModifier, type: gmModifier > 0 ? 'bonus' : 'malus' }] : []),
          ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
          { label: 'Seuil', value: chancesDeReussite, type: 'total' },
        ]

        const timestamp = new Date().toISOString()
        io.to(pending.campaignId).emit(WS.DICE_RESULT, {
          userId: pending.playerUserId,
          username: pending.playerName,
          color,
          formula: formulaLabel,
          rolls,
          total: diceRoll,
          type: 'entity_action',
          isCriticalSuccess: false,
          isCriticalFail: false,
          seed,
          timestamp,
          skillLabel: formulaLabel,
          mechanicalTotal,
          chancesDeReussite,
          effectiveMalus,
          diffLabel,
          isSuccess,
          breakdown,
        })

        if (isSuccess) {
          await resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)
        }
      } catch (err) {
        console.error('[WS] entity:action_resolve dice error:', err.message)
      }
    } catch (err) {
      console.error('[WS] entity:action_resolve error:', err.message)
    }
  })

  // ─── ENTITY:ACTION_GM_DIRECT ──────────────────────────────────────────────
  // Le GM déclenche une interaction directement, sans arbitrage ni traçage.
  // Payload : { entityId, interactionId }
  socket.on(WS.ENTITY_ACTION_GM_DIRECT, async ({ entityId, interactionId }) => {
    try {
      if (!isGm) return
      if (!campaignId) return
      if (!entityId || !interactionId) return
      await resolveEntityState(entityId, interactionId, campaignId, io)
    } catch (err) {
      console.error('[WS] entity:action_gm_direct error:', err.message)
    }
  })

  // ─── ENTITY:CREATED ────────────────────────────────────────────────────
  // Le GM vient de poser une entité (après POST REST réussi).
  // Payload : { entityId }
  // POST /entities invalide directement la révision runtime du monde.
  // Ce handler gère uniquement le broadcast ciblé (gm_only).
  socket.on(WS.ENTITY_CREATED, async ({ entityId }) => {
    try {
      if (!isGm) return
      if (!campaignId) return

      const row = await db('entities')
        .where({ 'entities.id': entityId })
        .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
        .select(
          'entities.*',
          'entity_blueprints.label as bp_label',
          'entity_blueprints.glb_url as bp_glb_url',
          'entity_blueprints.geometry as bp_geometry',
          'entity_blueprints.states as bp_states',
          'entity_blueprints.interactions as bp_interactions',
          'entity_blueprints.deprecated as bp_deprecated',
          'entity_blueprints.created_by as bp_created_by',
          'entity_blueprints.pack_id as bp_pack_id',
        )
        .first()

      if (!row) return

      const { bp_label, bp_glb_url, bp_geometry, bp_states, bp_interactions, bp_deprecated, bp_created_by, bp_pack_id, ...instance } = row
      const entityWithBlueprint = {
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

      // Broadcast ciblé — gm_only exclut les joueurs
      const roomSockets = await io.in(campaignId).fetchSockets()
      for (const s of roomSockets) {
        if (s.data.role !== 'gm' && row.gm_only) continue
        s.emit(WS.ENTITY_CREATED, { entity: entityWithBlueprint })
      }
    } catch (err) {
      console.error('[WS] entity:created error:', err.message)
    }
  })

  // ─── ENTITY:DELETED ────────────────────────────────────────────────────
  // Le GM a supprimé une entité (après DELETE REST réussi).
  // DELETE /entities/:id invalide directement la révision runtime du monde.
  // Ce handler gère uniquement le broadcast.
  // Payload : { entityId }
  socket.on(WS.ENTITY_DELETED, async ({ entityId }) => {
    try {
      if (!isGm) return
      io.to(campaignId).emit(WS.ENTITY_DELETED, { entityId })
    } catch (err) {
      console.error('[WS] entity:deleted error:', err.message)
    }
  })

  // ─── ENTITY:MOVED ──────────────────────────────────────────────────────
  // Le GM a déplacé une entité dans l'éditeur (après PUT REST réussi).
  // PUT /entities/:id invalide directement la révision runtime du monde.
  // Ce handler gère uniquement le broadcast.
  // Payload : { entityId, pos_x, pos_y, pos_z, r }
  socket.on(WS.ENTITY_MOVED, async ({ entityId, pos_x, pos_y, pos_z, r }) => {
    try {
      if (!isGm) return
      io.to(campaignId).emit(WS.ENTITY_MOVED, { entityId, pos_x, pos_y, pos_z, r })
    } catch (err) {
      console.error('[WS] entity:moved error:', err.message)
    }
  })

  // ─── ENTITY:MOVE_REQUEST ───────────────────────────────────────────────
  // Un joueur demande à déplacer une entité (push/pull orthogonal — 9F-B).
  // Le serveur est source de vérité : il recalcule l'attribut, le jet, le Dmax,
  // et exécute le déplacement dans le WorldSnapshot autoritaire.
  //
  // Payload : { entityId, tokenId, interactionId, moveType, destX, destZ }
  //   moveType = 'push'|'pull' — calculé client par dot(AE,AD), revalidé serveur (PE27)
  //   destX    = pos_x base (= Three.js X, identiques)
  //   destZ    = pos_y base (profondeur — Three.js Z — PE14)
  //
  // Broadcasts : ENTITY_MOVED + TOKEN_MOVED → room
  // Résultat   : ENTITY_MOVE_RESULT → socket.id uniquement
  socket.on(WS.ENTITY_MOVE_REQUEST, async ({ entityId, tokenId, interactionId, moveType, destX, destZ }) => {
    try {
      console.log(`[DBG] ENTITY_MOVE_REQUEST reçu — entity:${entityId} token:${tokenId} destX:${destX} destZ:${destZ} moveType:${moveType}`)

      // ── Guards entrée ────────────────────────────────────────────────
      if (!campaignId) { console.log('[DBG] RETURN — pas de campaignId'); return }
      if (!entityId || !tokenId || !interactionId) { console.log('[DBG] RETURN — IDs manquants'); return }
      if (destX === undefined || destZ === undefined) { console.log('[DBG] RETURN — dest manquant'); return }

      // Guard double-soumission — même entité déjà en attente (pendingEntityActions)
      const alreadyPending = [...pendingEntityActions.values()]
        .some(p => p.entityId === entityId)
      if (alreadyPending) { console.log('[DBG] RETURN — déjà en attente'); return }

      // ── Charger entité ───────────────────────────────────────────────
      const entity = await db('entities').where({ id: entityId }).first()
      if (!entity) { console.log('[DBG] RETURN — entité introuvable'); return }
      console.log(`[DBG] entité chargée — pos:(${entity.pos_x},${entity.pos_y},${entity.pos_z})`)

      // ── Charger blueprint + interaction ──────────────────────────────
      const blueprint = await db('entity_blueprints')
        .where({ id: entity.blueprint_id }).first()
      if (!blueprint) { console.log('[DBG] RETURN — blueprint introuvable'); return }

      const interaction = (blueprint.interactions || []).find(i => i.id === interactionId)
      if (!interaction) { console.log('[DBG] RETURN — interaction introuvable'); return }

      // Vérifier que c'est bien une interaction de déplacement
      if (!interaction.move_type) { console.log('[DBG] RETURN — interaction sans move_type'); return }

      // Vérifier que l'interaction n'est pas désactivée sur cette instance
      if ((entity.disabled_interactions || []).includes(interactionId)) { console.log('[DBG] RETURN — interaction désactivée'); return }

      // ── Charger token acteur + vérifier ownership ─────────────────
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) { console.log('[DBG] RETURN — token introuvable'); return }
      console.log(`[DBG] token chargé — pos:(${token.pos_x},${token.pos_y},${token.pos_z})`)

      // Ownership : le character lié au token doit appartenir au joueur émetteur
      if (token.character_id) {
        const character = await db('characters')
          .where({ id: token.character_id }).first()
        if (!character || character.user_id !== user.id) { console.log('[DBG] RETURN — ownership refusé'); return }
      } else {
        // Token sans character → seul le GM peut interagir
        console.log('[DBG] RETURN — token sans character')
        return
      }

      // ── Valider la portée dans les métriques 3D du monde ──────────────
      const measurement = await measureBattlemapTokenEntityDistance({ tokenId, entityId })
      if (measurement.status !== 'ok') { console.log(`[DBG] RETURN — mesure monde:${measurement.status}`); return }
      Object.assign(token, measurement.token)
      Object.assign(entity, measurement.entity)
      const rangeDist = measurement.distanceM
      const overrides = entity.interaction_overrides?.[interactionId] || {}
      const effectiveRange    = overrides.range         ?? interaction.range         ?? 1.5
      const effectiveDifficulty = overrides.difficulty_dc ?? interaction.difficulty_dc ?? 0
      console.log(`[DBG] portée — rangeDist:${rangeDist} effectiveRange:${effectiveRange}`)
      if (rangeDist > effectiveRange) { console.log('[DBG] RETURN — hors portée'); return }

      // ── Valider direction destination ────────────────────────────────
      const dPosX = destX - entity.pos_x
      const dPosY = destZ - entity.pos_y
      console.log(`[DBG] direction — dPosX:${dPosX} dPosY:${dPosY}`)

      if (dPosX === 0 && dPosY === 0) { console.log('[DBG] RETURN — destination = position actuelle'); return }

      const isDiagonal = dPosX !== 0 && dPosY !== 0
      if (isDiagonal && Math.abs(dPosX) !== Math.abs(dPosY)) { console.log(`[DBG] RETURN — diagonal invalide |dPosX|:${Math.abs(dPosX)} |dPosY|:${Math.abs(dPosY)}`); return }

      // ── Détermination et validation moveType par vecteur dot(AE, AD) — PE27 ──
      const AE = { x: entity.pos_x - token.pos_x, y: entity.pos_y - token.pos_y }
      const AD = { x: destX - token.pos_x,         y: destZ - token.pos_y }
      const dot = AE.x * AD.x + AE.y * AD.y
      console.log(`[DBG] dot — AE:(${AE.x},${AE.y}) AD:(${AD.x},${AD.y}) dot:${dot}`)
      if (dot === 0) { console.log('[DBG] RETURN — dot=0 ambigu'); return }
      const actualMoveType = dot > 0 ? 'push' : 'pull'
      console.log(`[DBG] moveType — client:${moveType} serveur:${actualMoveType}`)
      if (moveType && moveType !== actualMoveType) { console.log('[DBG] RETURN — moveType discordant'); return }

      // ── Charger stats character pour le jet d'attribut ───────────────
      const sheet = await db('char_sheet')
        .where({ character_id: token.character_id }).first()
      if (!sheet) return

      const [attrs, archetype, mutationEffects] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheet.id }),
        db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
        getMutationEffects(sheet.id),
      ])
      const genotypeRow = archetype?.genotype_id
        ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
        : null

      // attribute_id depuis l'interaction (configurable — ex: 'FOR')
      const attributeId = interaction.attribute_id || 'FOR'
      const attributeNA = calcAttributeNA(attrs, attributeId, genotypeRow, mutationEffects)

      // ── Jet 1d20 ────────────────────────────────────────────────────
      const { rolls, total: diceRoll, seed } = await parseDice('1d20')

      // ── Calcul seuil, réussite, MR et Dmax ──────────────────────────
      // Formule Polaris : chancesDeReussite = attributeNA + effectiveDifficulty (signé)
      // Réussite si diceRoll <= chancesDeReussite.
      // MR = chancesDeReussite - diceRoll (positif si réussite, négatif si échec).
      // modifier = getModifier(mrTable, mr) — LdB p.209, migration 46.
      // dmax = modifier + 1 si réussite (toute réussite = au moins 1 case), 0 si échec.
      const chancesDeReussite = attributeNA + effectiveDifficulty
      const isSuccess = diceRoll <= chancesDeReussite
      const mr = chancesDeReussite - diceRoll
      const mrTable = await getMrTable()
      const modifier = isSuccess ? getModifier(mrTable, mr) : 0
      let dmax = isSuccess ? modifier + 1 : 0

      // Override déplacement — dmax_override plafonne push ET pull (session 40)
      if (interaction.dmax_override !== null && interaction.dmax_override !== undefined) {
        dmax = Math.min(dmax, interaction.dmax_override)
      }

      // ── Couleur joueur pour DICE_RESULT ──────────────────────────────
      const color = await getUserColor(db, user.id)

      const diffLabel = effectiveDifficulty >= 0
        ? `+${effectiveDifficulty}` : `${effectiveDifficulty}`
      const timestamp = new Date().toISOString()

      // Broadcast DICE_RESULT — visible dans le chat pour joueur et GM
      const breakdownDisp = [
        { label: ATTR_LABELS[attributeId] || attributeId, value: attributeNA, type: 'base' },
        ...(effectiveDifficulty !== 0 ? [{ label: 'Difficulté', value: effectiveDifficulty, type: effectiveDifficulty > 0 ? 'bonus' : 'malus' }] : []),
        { label: 'Seuil', value: chancesDeReussite, type: 'total' },
      ]
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: user.id,
        username: user.username,
        color,
        formula: ATTR_LABELS[attributeId] || attributeId,
        rolls,
        total: diceRoll,
        type: 'entity_action',
        interactionType: 'displacement',
        isCriticalSuccess: false,
        isCriticalFail: false,
        seed,
        timestamp,
        skillLabel: ATTR_LABELS[attributeId] || attributeId,
        mechanicalTotal: attributeNA,
        chancesDeReussite,
        diffLabel,
        isSuccess,
        mr,
        breakdown: breakdownDisp,
      })

      // ── Échec (Dmax = 0) → résultat immédiat, pas de mouvement ───────
      if (dmax === 0) {
        socket.emit(WS.ENTITY_MOVE_RESULT, {
          requestId: `${entityId}-${interactionId}-${Date.now()}`,
          diceResult: diceRoll,
          mr,
          dmax: 0,
          finalEntityPos: { pos_x: entity.pos_x, pos_y: entity.pos_y, pos_z: entity.pos_z },
          finalActorPos:  { pos_x: token.pos_x,  pos_y: token.pos_y,  pos_z: token.pos_z },
          success: false,
        })
        return
      }

      // ── Step-by-step ────────────────────────────────────────────────
      // Le couple acteur/objet s'exclut lui-même des contrôles d'occupation.
      const movement = await executeBattlemapRigidPairMovement({
        battlemapId: entity.battlemap_id,
        tokenId,
        entityId,
        destination: { x: Number(destX), y: Number(entity.pos_z), z: Number(destZ) },
        maxSteps: dmax,
      })

      const stepsCompleted = movement.result?.stepsCompleted || 0

      // Guard : 0 pas complétés = entité bloquée dès le premier pas (collision)
      // Malgré un Dmax > 0, la case (k=1) est occupée — pas de mouvement.
      if (stepsCompleted === 0) {
        socket.emit(WS.ENTITY_MOVE_RESULT, {
          requestId: `${entityId}-${interactionId}-${Date.now()}`,
          diceResult: diceRoll,
          mr,
          dmax,
          finalEntityPos: { pos_x: entity.pos_x, pos_y: entity.pos_y, pos_z: entity.pos_z },
          finalActorPos:  { pos_x: token.pos_x,  pos_y: token.pos_y,  pos_z: token.pos_z },
          success: false,
        })
        return
      }

      // Positions finales (stepsCompleted ≥ 1)
      // ── Update DB ────────────────────────────────────────────────────
      const updatedEntity = movement.entity
      const updatedToken = movement.token

      io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
        battlemapId: entity.battlemap_id,
        runtimeRevision: movement.runtimeRevision,
        kind: 'forced-movement',
      })
      for (const passenger of movement.elevatorPassengerTokens || []) {
        io.to(campaignId).emit(WS.TOKEN_MOVED, {
          tokenId: passenger.id,
          pos_x: passenger.pos_x,
          pos_y: passenger.pos_y,
          pos_z: passenger.pos_z,
          position_space: passenger.position_space,
          updated_at: passenger.updated_at,
          worldMovement: { kind: 'elevator-passenger' },
        })
      }

      // ── Broadcasts room ──────────────────────────────────────────────
      io.to(campaignId).emit(WS.ENTITY_MOVED, {
        entityId: updatedEntity.id,
        pos_x: updatedEntity.pos_x,
        pos_y: updatedEntity.pos_y,
        pos_z: updatedEntity.pos_z,
        updated_at: updatedEntity.updated_at,
        worldMovement: { kind: 'forced', stepsCompleted },
      })

      io.to(campaignId).emit(WS.TOKEN_MOVED, {
        tokenId: updatedToken.id,
        pos_x: updatedToken.pos_x,
        pos_y: updatedToken.pos_y,
        pos_z: updatedToken.pos_z,
        position_space: updatedToken.position_space,
        updated_at: updatedToken.updated_at,
        worldMovement: {
          kind: 'forced',
          stepsCompleted,
          effectEvents: movement.effectEvents,
        },
      })

      // ── Résultat vers joueur uniquement ──────────────────────────────
      socket.emit(WS.ENTITY_MOVE_RESULT, {
        requestId: `${entityId}-${interactionId}-${Date.now()}`,
        diceResult: diceRoll,
        mr,
        dmax,
        finalEntityPos: {
          pos_x: updatedEntity.pos_x,
          pos_y: updatedEntity.pos_y,
          pos_z: updatedEntity.pos_z,
        },
        finalActorPos: {
          pos_x: updatedToken.pos_x,
          pos_y: updatedToken.pos_y,
          pos_z: updatedToken.pos_z,
        },
        success: stepsCompleted > 0,
      })

      console.log(`[WS] entity:move_request — ${user.username} → ${actualMoveType} entité ${entityId} (MR:${mr} Dmax:${dmax} steps:${stepsCompleted})`)
    } catch (err) {
      console.error('[WS] entity:move_request error:', err.message)
    }
  })

  // ── Mise à jour partielle d'une entité (gm_only, ...) ─────────────────────
  // Émis par EntityInstancePanel après PUT /entities — rebroadcast à la room.
  socket.on(WS.ENTITY_UPDATED, ({ entityId, gm_only, current_state_id, state, updated_at }) => {
    if (!isGm) return
    if (!campaignId || !entityId) return
    io.to(campaignId).emit(WS.ENTITY_UPDATED, {
      entityId,
      gm_only,
      ...(current_state_id !== undefined ? { current_state_id } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(updated_at !== undefined ? { updated_at } : {}),
    })
    console.log(`[WS] entity:updated — GM broadcast gm_only=${gm_only} entité ${entityId}`)
  })
}
