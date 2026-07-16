import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition, setFSMSubPhase } from '../lib/combatFSM.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { parseDice } from '../lib/diceParser.js'
import { getMrTable, getModifier } from '../lib/mrTable.js'
import * as statusService from '../lib/statusService.js'
import * as damageService from '../lib/damageService.js'
import { calcSkillTotal, calcDroneDegatsNets } from '../lib/charStats.js'
import { getMutationEffects } from '../services/mutationService.js'
import { getCharacterMovementBudget } from '../services/movementBudgetService.js'
import { executeBattlemapTokenMovement } from '../services/worldMovementService.js'
import { measureBattlemapTokenDistance } from '../services/worldSpatialQueryService.js'
import { LOCATION_LABELS } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
import {
  advanceSlot, endTurn,
  resolveMeleeAction, resolveReloadAction,
  resolveDroneAssaultAction, resolveAssaultAction,
  COMBAT_MODE_LABELS,
} from './socketCombatHelpers.js'

async function flushEmissions(io, socket, campaignId, emissions, preloadedSockets = null) {
  const needsLookup = emissions.some(e => e.to === 'user')
  const allSockets = needsLookup ? (preloadedSockets ?? await io.fetchSockets()) : []
  for (const e of emissions) {
    if (e.to === 'room') {
      io.to(campaignId).emit(e.event, e.data)
    } else if (e.to === 'socket') {
      socket.emit(e.event, e.data)
    } else if (e.to === 'user') {
      const s = allSockets.find(s => s.user?.id === e.userId && s.campaignId === campaignId)
      if (s) {
        s.emit(e.event, e.data)
      } else if (e.fallback === 'room') {
        io.to(campaignId).emit(e.event, e.data)
      } else {
        socket.emit(e.event, e.data)
      }
    }
  }
}

export function registerResolutionHandlers(io, socket, context, pendingMaps) {
  const { campaignId, user, isGm } = context

  // ─── COMBAT_ACTION_PRECHECK — Pre-validation gate (ACK Socket.IO v4) ─────
  // Émis par le client AVANT d'ouvrir CombatCacModifiersWindow.
  // Valide : FSM state + portée CaC. Répond { ok: boolean } via ACK natif.
  // Si !ok : broadcaste COMBAT_DECLARE_ERROR avant callback.
  socket.on(WS.COMBAT_ACTION_PRECHECK, async ({ tokenId, actionKey }, callback) => {
    try {
      // 1. FSM guard — socket.emit (pas io.to) : erreur de contexte individuel, pas un état partagé.
      // Si un joueur reconnecté envoie PRECHECK hors RESOLUTION, le reste de la room ne doit pas recevoir l'erreur.
      const state = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!canTransition(state?.phase ?? null, state?.sub_phase ?? null, 'COMBAT_ACTION_CONFIRM')) {
        if (state?.sub_phase === 'AWAITING_DAMAGE') {
          // Damage d'une attaque précédente en attente — pas d'erreur, client retentera après COMBAT_ATTACK_RESULT
          return callback({ awaiting: true })
        }
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Action non autorisée dans cet état de combat' })
        return callback({ ok: false })
      }
      // 2. Guard stun — avant tout check LOS/range (STUN2)
      // Si assommé : auto-skip serveur + { ok: false, stunned: true } — débloque le slot figé
      // Gaté par status_effects_mode (PLAN 14 Sprint 14-3) — 'enforced' uniquement
      {
        const { status_effects_mode: statusEffectsModePrecheck } = await getCampaignSettings(db, campaignId)
        const enforcedPrecheck = statusEffectsModePrecheck === 'enforced'
        const stunnedStatus = enforcedPrecheck
          ? await db('token_statuses')
              .where({ token_id: tokenId })
              .whereIn('status_code', ['stunned', 'unconscious'])
              .first()
          : null
        const pendingStun = (enforcedPrecheck && !stunnedStatus)
          ? await db('combat_pending')
              .where({ campaign_id: campaignId, token_id: tokenId, type: 'stun' })
              .first()
          : null
        if (stunnedStatus || pendingStun) {
          console.log(`[STUN2] PRECHECK token ${tokenId} assommé — auto-skip`)
          const slots = await db('combat_roster')
            .where({ campaign_id: campaignId, status: 'active', has_announced: true })
            .orderBy('initiative', 'desc')
            .select('token_id', 'initiative')
          await db('combat_actions')
            .where({ campaign_id: campaignId, token_id: tokenId, status: 'pending' })
            .update({ status: 'resolved' })
          socket.emit(WS.COMBAT_DECLARE_ERROR, { stunned: true, statusCode: stunnedStatus?.status_code ?? 'stunned' })
          await advanceSlot(io, campaignId, slots, state.active_slot_idx + 1, pendingMaps)
          return callback({ ok: false, stunned: true })
        }
      }
      // 3. Range check CaC — colonne 'type' (cohérent L.907 serveur)
      if (actionKey === 'melee') {
        const action = await db('combat_actions')
          .where({ campaign_id: campaignId, token_id: tokenId, type: 'melee', status: 'pending' })
          .first()
        if (action?.target_token_id) {
          // allonge XOR : weapon_inv_id (humanoïde) ou drone_weapon_inv_id (drone) — contrainte migration 76
          let allonge = 0
          if (action.weapon_inv_id) {
            const w = await db('char_inventory')
              .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
              .where({ 'char_inventory.id': action.weapon_inv_id })
              .select('ref_equipment.range as ref_range')
              .first()
            allonge = parseInt(w?.ref_range) || 0
          } else if (action.drone_weapon_inv_id) {
            const w = await db('drone_weapons')
              .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
              .where({ 'drone_weapons.id': action.drone_weapon_inv_id })
              .select('ref_equipment.range as ref_range')
              .first()
            allonge = parseInt(w?.ref_range) || 0
          }
          const measurement = await measureBattlemapTokenDistance({
            sourceTokenId: tokenId,
            targetTokenId: action.target_token_id,
          })
          if (measurement.status !== 'ok' || measurement.distanceM > 3 + allonge) {
            return callback({ ok: false })
          }
        }
      }
      // LOS assault : vérifié à la résolution dans resolveAssaultAction → checkCombatLOS
      console.log(`[DBG] PRECHECK ${actionKey} token:${tokenId} → ok:true`)
      callback({ ok: true })
    } catch (err) {
      console.error('[WS] COMBAT_ACTION_PRECHECK erreur:', err)
      callback({ ok: false })
    }
  })

  // ─── COMBAT_ACTION_CONFIRM — Phase Résolution ─────────────────────────
  // Joueur (ou GM pour PNJ) confirme l'exécution du slot actif.
  // Résout les actions dans l'ordre sequence ASC, avance au slot suivant.
  // Payload : { tokenId, confirmedModifiers? }
  socket.on(WS.COMBAT_ACTION_CONFIRM, async ({ tokenId, confirmedModifiers }) => {
    console.log(`[DBG] COMBAT_ACTION_CONFIRM — tokenId:${tokenId} mods:${JSON.stringify(confirmedModifiers ?? null)}`)
    try {
      const state = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!canTransition(state?.phase ?? null, state?.sub_phase ?? null, 'COMBAT_ACTION_CONFIRM')) {
        console.warn(`[FSM] guard bloqué : ${state?.phase ?? null}|${state?.sub_phase ?? null} + COMBAT_ACTION_CONFIRM`)
        return
      }
      // Guard : phase = RESOLUTION
      if (!state || state.phase !== 'RESOLUTION') {
        return
      }

      // Slots ordonnés par initiative DESC — source de vérité pour active_slot_idx
      const slots = await db('combat_roster')
        .where({ campaign_id: campaignId, status: 'active', has_announced: true })
        .orderBy('initiative', 'desc')
        .select('token_id', 'initiative')

      const activeSlot = slots[state.active_slot_idx]
      if (!activeSlot || activeSlot.token_id !== tokenId) {
        return
      }

      // Guard ownership — GM peut confirmer n'importe quel slot, joueur uniquement le sien
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) {
        return
      }
      if (!token.character_id) {
        return
      }
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character) {
        return
      }
      if (!isGm) {
        if (character.user_id !== user.id) return
      }

      // Guard is_stunned (STUN2) — filet de sécurité si PRECHECK n'a pas été émis (move/reload/micro)
      // Gaté par status_effects_mode (PLAN 14 Sprint 14-3) — 'enforced' uniquement
      {
        const { status_effects_mode: statusEffectsModeConfirm } = await getCampaignSettings(db, campaignId)
        const enforcedConfirm = statusEffectsModeConfirm === 'enforced'
        const stunnedStatus = enforcedConfirm
          ? await db('token_statuses')
              .where({ token_id: tokenId })
              .whereIn('status_code', ['stunned', 'unconscious'])
              .first()
          : null
        const pendingStun = (enforcedConfirm && !stunnedStatus)
          ? await db('combat_pending')
              .where({ campaign_id: campaignId, token_id: tokenId, type: 'stun' })
              .first()
          : null
        if (stunnedStatus || pendingStun) {
          console.log(`[STUN2] CONFIRM token ${tokenId} assommé — slot auto-skipé`)
          await db('combat_actions')
            .where({ campaign_id: campaignId, token_id: tokenId, status: 'pending' })
            .update({ status: 'resolved' })
          socket.emit(WS.COMBAT_DECLARE_ERROR, { stunned: true, statusCode: stunnedStatus?.status_code ?? 'stunned' })
          await advanceSlot(io, campaignId, slots, state.active_slot_idx + 1, pendingMaps)
          return
        }
      }

      // Lire les actions pendantes pour ce token, dans l'ordre d'exécution
      const actions = await db('combat_actions')
        .where({ campaign_id: campaignId, token_id: tokenId, status: 'pending' })
        .orderBy('sequence', 'asc')

      // Séparer melee (traitement séquentiel multi-attaque) du reste
      const nonMeleeActions = actions.filter(a => a.type !== 'melee')
      const meleeActions    = actions.filter(a => a.type === 'melee')

      // Résolution actions non-melee (move, assault, reload, micro)
      let needsDefenseWait = false
      for (const action of nonMeleeActions) {
        if (action.type === 'move_short' || action.type === 'move_long') {
          let outcome = null
          try {
            if (!action.destination_world || !action.movement_gait) {
              throw new RangeError('Intention de déplacement antérieure au moteur de monde')
            }
            const budget = await getCharacterMovementBudget(character.id, action.movement_gait)
            outcome = await executeBattlemapTokenMovement({
              battlemapId: token.battlemap_id,
              tokenId,
              destination: action.destination_world,
              authorizedBudgetM: budget.budgetM,
            })
          } catch (error) {
            console.warn(`[WS] déplacement combat refusé token:${tokenId} — ${error.message}`)
          }

          const worldChanged = Boolean(outcome) && (
            Number(action.planned_world_revision) !== Number(outcome.result?.worldRevision)
            || Number(action.planned_runtime_revision) !== Number(outcome.evaluatedRuntimeRevision)
          )
          if (outcome?.moved || outcome?.elevatorRuntime?.changed) {
            io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
              battlemapId: token.battlemap_id,
              runtimeRevision: outcome.runtimeRevision || outcome.elevatorRuntime.runtimeRevision,
              kind: outcome.moved ? 'combat-movement' : 'elevator-clock',
            })
          }
          for (const passenger of outcome?.elevatorPassengerTokens || []) {
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
          if (outcome?.moved) {
            io.to(campaignId).emit(WS.TOKEN_MOVED, {
              tokenId: outcome.token.id,
              pos_x: outcome.token.pos_x,
              pos_y: outcome.token.pos_y,
              pos_z: outcome.token.pos_z,
              position_space: outcome.token.position_space,
              updated_at: outcome.token.updated_at,
              worldMovement: {
                kind: 'combat-resolution',
                pathId: outcome.result.plan.pathId,
                spentM: outcome.result.plan.spentM,
                stopReason: outcome.result.plan.stopReason,
                worldChanged,
                replanned: true,
                effectEvents: outcome.effectEvents,
              },
            })
            Object.assign(token, outcome.token)
          }
          const partial = outcome?.result?.status === 'budget'
          if (!outcome?.moved || partial) {
            console.log(`[WS] COMBAT_ACTION_CONFIRM — déplacement ${partial ? 'partiel' : 'bloqué'} token:${tokenId}`)
            socket.emit(WS.COMBAT_RESOLVE_MOVE_BLOCKED, {
              tokenLabel: token.label,
              partial,
              worldChanged,
              reason: outcome?.status || 'invalid-world-plan',
              reached: outcome?.result?.plan?.end || null,
            })
          }
        } else if (action.type === 'assault') {
          if (!confirmedModifiers && character.type !== 'drone') {
            console.warn(`[WS] COMBAT_ACTION_CONFIRM — assault sans confirmedModifiers. token:${tokenId}`)
          } else {
            const assaultResult = await resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps)
            if (assaultResult) await flushEmissions(io, socket, campaignId, assaultResult.emissions)
          }
        } else if (action.type === 'reload') {
          await resolveReloadAction(io, socket, campaignId, character, action)
        }
        // micro / skip : resolved direct, pas d'effet V1
        await db('combat_actions')
          .where({ id: action.id })
          .update({ status: 'resolved', updated_at: db.fn.now() })
      }

      // Résolution melee : marquer toutes les rows resolved upfront, puis traiter séquentiellement
      if (meleeActions.length > 0) {
        for (const a of meleeActions) {
          await db('combat_actions').where({ id: a.id }).update({ status: 'resolved', updated_at: db.fn.now() })
        }
        if (character.type === 'drone') {
          const droneResult = await resolveDroneAssaultAction(io, campaignId, meleeActions[0], confirmedModifiers, character, pendingMaps)
          if (droneResult) await flushEmissions(io, socket, campaignId, droneResult.emissions)
        } else {
          const meleeResult = await resolveMeleeAction(
            io, campaignId, meleeActions[0], character,
            meleeActions.slice(1), meleeActions.length, confirmedModifiers, pendingMaps
          )
          if (meleeResult) {
            await flushEmissions(io, socket, campaignId, meleeResult.emissions)
            needsDefenseWait = meleeResult.suspend
          }
        }
      }

      // Slot bloqué si on attend le jet de défense d'un PJ
      if (!needsDefenseWait) {
        await advanceSlot(io, campaignId, slots, state.active_slot_idx + 1, pendingMaps)
      }
    } catch (err) {
      console.error('[WS] COMBAT_ACTION_CONFIRM error:', err.message)
    }
  })

  // ─── COMBAT_DAMAGE_CONFIRM — PJ lance les dés (calcul serveur) ────────────
  socket.on(WS.COMBAT_DAMAGE_CONFIRM, async ({ tokenId }) => {
    const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
    if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_DAMAGE_CONFIRM')) {
      console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_DAMAGE_CONFIRM`)
      return
    }
    const row = await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'damage' }).first()
    if (!row) {
      console.warn(`[WS] COMBAT_DAMAGE_CONFIRM — pas de pending pour token:${tokenId}`)
      return
    }
    const pending = row.payload
    if (pending.userId !== user.id && pending.targetUserId !== user.id && !isGm) return
    await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'damage' }).delete()
    await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')

    const {
      campaignId: pendingCampaignId, targetTokenId, characterIdCible, cibleType = null, char_sheet_id_cible,
      mr, portee, fire_mode_bonus_dmg, formula,
      for_na_cible, con_na_cible, vol_na_cible,
      tireurUsername, tireurColor, userId, targetName,
      type: pendingType, modDom, combatModeBonus,
    } = pending

    try {
      // Calcul dégâts (branche melee vs assault)
      const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula.replace(/\s/g, ''))
      let degautsBruts
      if (pendingType === 'melee') {
        degautsBruts = rawDice + (modDom ?? 0) + (combatModeBonus ?? 0)
      } else {
        const mrTable = await getMrTable()
        const modDomAttaque = getModifier(mrTable, mr)
        const isShortRange = ['bout_portant', 'courte'].includes(portee)
        const modDegatsMode = isShortRange ? fire_mode_bonus_dmg : 0
        degautsBruts = rawDice + modDomAttaque + modDegatsMode
      }
      // Branche drone — cible sans char_sheet, résistance = blindage + intégrité×2 (§7.6)
      if (cibleType === 'drone' && characterIdCible) {
        const droneSheet = await db('drone_sheet').where({ character_id: characterIdCible }).first()
        if (droneSheet) {
          const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
          await resolveDroneIntegrityLoss(io, pendingCampaignId, characterIdCible, targetTokenId, droneSheet, degatsNetsDrone)
          socket.emit(WS.COMBAT_DAMAGE_RESULT, {
            rollLoc: null, locLabel: null,
            degautsBruts, degatsNets: degatsNetsDrone,
            dmgRolls, severity: null, severityColor: tireurColor, shockResult: null,
          })
          const now = new Date().toISOString()
          io.to(pendingCampaignId).emit(WS.DICE_RESULT, {
            userId, username: tireurUsername, color: tireurColor,
            formula, rolls: dmgRolls, total: degautsBruts,
            isCriticalSuccess: false, isCriticalFail: false,
            seed: dmgSeed, timestamp: now,
            skillLabel: `Dégâts — drone`,
            mechanicalTotal: rawDice,
            diffLabel: `Blindage:${etqDrone} RD:${rdDrone}`,
            chancesDeReussite: degatsNetsDrone,
            isSuccess: degatsNetsDrone > 0,
          })
          io.to(pendingCampaignId).emit(WS.COMBAT_ATTACK_RESULT, {
            tireurId: tokenId, cibleId: targetTokenId,
            localisation: null,
            degautsBruts, degatsNets: degatsNetsDrone,
            severity: null, is_lethal: false, isSuccess: true, shockResult: null,
          })
        }
        return
      }

      const hitResult = await damageService.resolveTargetHit(io, db, pendingCampaignId, {
        degautsBruts, characterIdCible, cibleType, char_sheet_id_cible,
        for_na_cible, con_na_cible, vol_na_cible,
      })
      if (hitResult === null) return
      const { rollLoc, locRolls, locSeed, localisation, etq, rd, degatsNets,
              is_lethal, finalSeverity, shockResult } = hitResult

      if (shockResult) {
        statusService.emitShockDiceResult(io, pendingCampaignId, shockResult, userId, tireurUsername, tireurColor)
      }

      const severityColor = finalSeverity ? (SEVERITY_COLORS[finalSeverity] ?? tireurColor) : tireurColor

      // 6. COMBAT_DAMAGE_RESULT → socket tireur uniquement (affichage fenêtre)
      socket.emit(WS.COMBAT_DAMAGE_RESULT, {
        rollLoc,
        locLabel: LOCATION_LABELS[localisation] ?? localisation,
        degautsBruts,
        degatsNets,
        dmgRolls,
        severity: finalSeverity,
        severityColor,
        shockResult,
      })

      // Stun — applyStun après l'émission pour ne pas bloquer l'affichage des dégâts
      if (shockResult?.outcome && shockResult.outcome !== 'ok') {
        statusService.applyStun(io, db, pendingCampaignId, {
          targetTokenId, outcome: shockResult.outcome,
          userId, username: tireurUsername, color: tireurColor,
        }).catch(err => console.error('[WS] applyStun error:', err.message))
      }

      // 7. DICE_RESULT broadcast chat
      const now = new Date().toISOString()
      io.to(pendingCampaignId).emit(WS.DICE_RESULT, {
        userId, username: tireurUsername, color: tireurColor,
        formula: '1d20', rolls: locRolls, total: rollLoc,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: locSeed, timestamp: now,
        skillLabel: 'Localisation — Distance',
        mechanicalTotal: rollLoc, diffLabel: '',
        chancesDeReussite: LOCATION_LABELS[localisation] ?? localisation,
        isSuccess: true,
      })
      io.to(pendingCampaignId).emit(WS.DICE_RESULT, {
        userId, username: tireurUsername, color: tireurColor,
        formula, rolls: dmgRolls, total: degautsBruts,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: dmgSeed, timestamp: now,
        skillLabel: `Dégâts — ${LOCATION_LABELS[localisation] ?? localisation}`,
        mechanicalTotal: rawDice,
        diffLabel: `ETQ:${etq ?? 0} RD:${rd}`,
        chancesDeReussite: degatsNets,
        isSuccess: degatsNets > 0,
      })

      // 8. Message narratif combat_damage
      if (finalSeverity) {
        io.to(pendingCampaignId).emit(WS.DICE_RESULT, {
          userId, username: tireurUsername, color: severityColor,
          formula: '', rolls: [], total: degatsNets,
          isCriticalSuccess: false, isCriticalFail: false,
          seed: '', timestamp: now,
          interactionType: 'combat_damage',
          skillLabel: `${tireurUsername} inflige ${degatsNets} dégâts`,
          targetName,
          localisation: LOCATION_LABELS[localisation] ?? localisation,
          severity: finalSeverity,
          severityColor,
          isSuccess: true,
        })
      }

      io.to(pendingCampaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId:    tokenId,
        cibleId:     targetTokenId,
        localisation,
        degautsBruts,
        degatsNets,
        severity:    finalSeverity,
        is_lethal,
        isSuccess:   true,
        shockResult: shockResult ?? null,
      })
    } catch (err) {
      console.error('[WS] COMBAT_DAMAGE_CONFIRM error:', err.message)
    }
  })

  // ─── COMBAT_MELEE_DEFENSE_CONFIRM — défenseur PJ valide son jet ───────────
  // Résout l'opposition (rollAttaque vs rollDefense), gère les dégâts, avance le slot.
  socket.on(WS.COMBAT_MELEE_DEFENSE_CONFIRM, async ({ tokenId }) => {
    const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
    if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_MELEE_DEFENSE_CONFIRM')) {
      console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_MELEE_DEFENSE_CONFIRM`)
      return
    }
    const row = await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense' }).first()
    if (!row) {
      console.warn(`[WS] COMBAT_MELEE_DEFENSE_CONFIRM — pas de pending pour defender:${tokenId}`)
      return
    }
    const pending = row.payload
    if (pending.defenderUserId !== user.id && !isGm) return
    await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense' }).delete()
    await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')

    const {
      campaignId: meleeCampaignId,
      attackerTokenId, attackerCharacter,
      attackerUsername, attackerColor,
      rollAttaque, chancesAttaque,
      defenderSkillTotal, defenderEffectiveMalus,
      multiMalusDefenseur,
      damageFormula, modDom, combatModeBonus,
      characterIdCible, char_sheet_id_cible,
      for_na_cible, con_na_cible, vol_na_cible,
      targetName, userId,
      remainingMeleeActions: pendingRemainingMelee = [],
      totalMeleeCount: pendingTotalMeleeCount = 1,
      confirmedModifiers: pendingConfirmedModifiers,
      situationDef: pendingSituationDef = [],
    } = pending

    try {
      // 1. Roll défense D20 (serveur)
      const { total: rollDefense, rolls: defRolls, seed: defSeed } = await parseDice('1d20')
      // Mode combat du défenseur PJ — Offensif/Charge → pénalité, Défensif/Retraite → bonus (CaC3)
      const rosterDef = await db('combat_roster').where({ campaign_id: meleeCampaignId, token_id: tokenId }).first()
      const defCombatMode = rosterDef?.state_combat_mode ?? 'normal'
      let chanceDefense = defenderSkillTotal + defenderEffectiveMalus + (multiMalusDefenseur ?? 0)
      if      (defCombatMode === 'offensif') chanceDefense -= 5
      else if (defCombatMode === 'charge')   chanceDefense -= 7
      else if (defCombatMode === 'defensif') chanceDefense += 3
      else if (defCombatMode === 'retraite') chanceDefense += 5

      // Terrain instable défenseur PJ — compétence limitative ACROBATIE_EQUILIBRE
      let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
      if (pendingSituationDef.includes('cac_terrain_instable') && char_sheet_id_cible) {
        const [attrsCibleDef, archetypeCibleDef, acrobatieCharDef, acrobatieRefDef, mutationEffectsCibleDef] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: char_sheet_id_cible }),
          db('char_archetype').where({ char_sheet_id: char_sheet_id_cible }).first(),
          db('char_skills').where({ char_sheet_id: char_sheet_id_cible, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
          db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
          getMutationEffects(char_sheet_id_cible),
        ])
        const genoCibleDef = archetypeCibleDef?.genotype_id
          ? await db('ref_genotypes').where({ id: archetypeCibleDef.genotype_id }).first() : null
        acrobatieDefTotal = acrobatieRefDef
          ? calcSkillTotal(attrsCibleDef, acrobatieCharDef, acrobatieRefDef, genoCibleDef, mutationEffectsCibleDef)
          : defenderSkillTotal
        terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
        chanceDefense += terrainInstableModDef
      }

      // 2. Résolution Polaris §6.2 : les deux réussissent → meilleure MR l'emporte, égalité = rien
      const mrAttaque      = chancesAttaque - rollAttaque
      const mrDefense      = chanceDefense  - rollDefense
      const attackSuccess  = rollAttaque  <= chancesAttaque
      const defenseSuccess = rollDefense  <= chanceDefense
      const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)

      const modeCombatDefPj = defCombatMode === 'offensif' ? -5 : defCombatMode === 'charge' ? -7 : defCombatMode === 'defensif' ? 3 : defCombatMode === 'retraite' ? 5 : 0
      const breakdownDefPj = [
        { label: 'Compétence', value: defenderSkillTotal, type: 'base' },
        ...(modeCombatDefPj !== 0 ? [{ label: COMBAT_MODE_LABELS[defCombatMode] ?? defCombatMode, value: modeCombatDefPj, type: modeCombatDefPj > 0 ? 'bonus' : 'malus' }] : []),
        ...((multiMalusDefenseur ?? 0) !== 0 ? [{ label: 'Multi-adversaires', value: multiMalusDefenseur, type: 'malus' }] : []),
        ...(defenderEffectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' }] : []),
        ...(terrainInstableModDef !== 0 ? [{ label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`, value: terrainInstableModDef, type: 'malus' }] : []),
        { label: 'Seuil', value: chanceDefense, type: 'total' },
      ]
      console.log(`[WS] melee défense — rollAtk:${rollAttaque}/${chancesAttaque} rollDef:${rollDefense}/${chanceDefense} → ${hit ? 'TOUCHÉ' : 'ESQUIVÉ/RATÉ'}`)

      // Broadcast roll défense au chat
      const now = new Date().toISOString()
      io.to(meleeCampaignId).emit(WS.DICE_RESULT, {
        userId: user.id, username: user.username,
        color: '#6060c0',
        formula: '1d20', rolls: defRolls, total: rollDefense,
        isCriticalSuccess: rollDefense === 1, isCriticalFail: rollDefense === 20,
        seed: defSeed, timestamp: now,
        skillLabel:        'Jet pour défendre (contact)',
        mechanicalTotal:   defenderSkillTotal,
        diffLabel:         chanceDefense - defenderSkillTotal >= 0 ? `+${chanceDefense - defenderSkillTotal}` : `${chanceDefense - defenderSkillTotal}`,
        chancesDeReussite: chanceDefense,
        isSuccess:         defenseSuccess,
        mr:                chanceDefense - rollDefense,
        breakdown:         breakdownDefPj,
      })

      // 3. Résultat opposition → room
      io.to(meleeCampaignId).emit(WS.COMBAT_MELEE_RESULT, {
        attaquantId: attackerTokenId,
        defenseurId: tokenId,
        rollAttaque, chancesAttaque,
        rollDefense, chanceDefense,
        hit,
        multiMalusAttaquant: pending.multiMalusAttaquant ?? 0,
        multiMalusDefenseur: pending.multiMalusDefenseur ?? 0,
      })

      // 4. Dégâts si touche
      if (hit) {
        if (attackerCharacter.type === 'pj') {
          // PJ attaquant : invite à lancer les dés de dégâts (CombatDamageWindow existant)
          await db('combat_pending').insert({
            campaign_id: meleeCampaignId,
            token_id: attackerTokenId,
            type: 'damage',
            payload: {
              type: 'melee',
              campaignId: meleeCampaignId,
              targetTokenId: tokenId,
              characterIdCible,
              char_sheet_id_cible,
              modDom,
              combatModeBonus,
              formula: damageFormula,
              for_na_cible,
              con_na_cible,
              vol_na_cible,
              tireurUsername: attackerUsername,
              tireurColor: attackerColor,
              userId,
              targetName,
            },
          })
          await setFSMSubPhase(db, meleeCampaignId, 'AWAITING_DAMAGE')
          // Trouver le socket de l'attaquant PJ
          const sockets = await io.fetchSockets()
          const attackerSocket = sockets.find(s =>
            s.campaignId === meleeCampaignId && s.user?.id === attackerCharacter.user_id
          )
          const prompt = { tokenId: attackerTokenId, formula: damageFormula, targetName }
          if (attackerSocket) {
            attackerSocket.emit(WS.COMBAT_DAMAGE_PROMPT, prompt)
          } else {
            socket.emit(WS.COMBAT_DAMAGE_PROMPT, prompt)  // fallback : même socket (rare)
          }
        } else {
          // PNJ attaquant : résolution auto des dégâts
          const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
          const degautsBruts = rawDice + (modDom ?? 0) + (combatModeBonus ?? 0)
          const hitResult = await damageService.resolveTargetHit(io, db, meleeCampaignId, {
            degautsBruts, characterIdCible, cibleType: 'pj',
            char_sheet_id_cible,
            for_na_cible, con_na_cible, vol_na_cible,
          })
          if (hitResult === null) return
          const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult

          if (shockResult) {
            statusService.emitShockDiceResult(io, meleeCampaignId, shockResult, userId, attackerUsername, attackerColor)
          }

          io.to(meleeCampaignId).emit(WS.COMBAT_ATTACK_RESULT, {
            tireurId:    attackerTokenId,
            cibleId:     tokenId,
            localisation,
            degautsBruts,
            degatsNets,
            severity:    finalSeverity,
            is_lethal,
            isSuccess:   true,
            isPnj:       true,
            roll:        rollAttaque,
            chancesDeReussite: chancesAttaque,
            shockResult,
          })
          if (shockResult?.outcome && shockResult.outcome !== 'ok') {
            statusService.applyStun(io, db, meleeCampaignId, {
              targetTokenId: tokenId, outcome: shockResult.outcome,
              userId, username: attackerUsername, color: attackerColor,
            }).catch(err => console.error('[WS] applyStun error:', err.message))
          }
        }
      }

      // 5. Attaque suivante (CaC 4b multi-attack) ou avance le slot
      if (pendingRemainingMelee.length > 0) {
        const [nextAction, ...restActions] = pendingRemainingMelee
        const allSockets = await io.fetchSockets()
        const attackerSocket = allSockets.find(
          s => s.campaignId === meleeCampaignId && s.user?.id === attackerCharacter.user_id
        ) || socket
        const nextMeleeResult = await resolveMeleeAction(
          io, meleeCampaignId,
          nextAction, attackerCharacter,
          restActions, pendingTotalMeleeCount, pendingConfirmedModifiers, pendingMaps
        )
        const waitForNext = nextMeleeResult?.suspend ?? false
        if (nextMeleeResult) {
          await flushEmissions(io, attackerSocket, meleeCampaignId, nextMeleeResult.emissions, allSockets)
        }
        if (!waitForNext) {
          const state = await db('combat_state').where({ campaign_id: meleeCampaignId }).first()
          const slots = await db('combat_roster')
            .where({ campaign_id: meleeCampaignId, status: 'active', has_announced: true })
            .orderBy('initiative', 'desc')
            .select('token_id', 'initiative')
          await advanceSlot(io, meleeCampaignId, slots, state.active_slot_idx + 1, pendingMaps)
        }
      } else {
        const state = await db('combat_state').where({ campaign_id: meleeCampaignId }).first()
        const slots = await db('combat_roster')
          .where({ campaign_id: meleeCampaignId, status: 'active', has_announced: true })
          .orderBy('initiative', 'desc')
          .select('token_id', 'initiative')
        await advanceSlot(io, meleeCampaignId, slots, state.active_slot_idx + 1, pendingMaps)
      }
    } catch (err) {
      console.error('[WS] COMBAT_MELEE_DEFENSE_CONFIRM error:', err.message)
    }
  })

  // ─── COMBAT_STUN_CONFIRM — PJ ou GM valide le lancer D6 durée étourdissement ─
  socket.on(WS.COMBAT_STUN_CONFIRM, async ({ tokenId }) => {
    const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
    if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_STUN_CONFIRM')) {
      console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_STUN_CONFIRM`)
      return
    }
    const row = await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'stun' }).first()
    if (!row) return
    const pending = row.payload
    const isAuthorized = pending.isGmPrompt
      ? isGm
      : (pending.targetUserId === user.id)
    if (!isAuthorized) return
    await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'stun' }).delete()

    const { total: d6Raw, rolls: d6Rolls, seed: d6Seed } = await parseDice('1d6')
    const stunDuration = pending.outcome === 'inconscient' ? d6Raw * 10 : d6Raw

    io.to(pending.campaignId).emit(WS.DICE_RESULT, {
      userId: pending.userId, username: pending.username, color: pending.color,
      formula: '1d6', rolls: d6Rolls, total: stunDuration,
      isCriticalSuccess: false, isCriticalFail: false,
      seed: d6Seed, timestamp: new Date().toISOString(),
      skillLabel: 'Durée étourdissement',
      mechanicalTotal: d6Raw,
      diffLabel:    pending.outcome === 'inconscient' ? ' ×10 (min→tours)' : ' tour(s)',
      chancesDeReussite: stunDuration,
      isSuccess: true,
    })
    await statusService.applyStunWithDuration(
      io, db, pending.campaignId, tokenId, pending.outcome, stunDuration, pending.currentTurn
    )
  })

  // ─── COMBAT_APPLY_STUN — GM applique manuellement is_stunned avec durée ──
  socket.on(WS.COMBAT_APPLY_STUN, async ({ tokenId, outcome, duration }) => {
    if (!isGm) return
    if (!tokenId || !['etourdi', 'inconscient'].includes(outcome)) return
    if (!Number.isInteger(duration) || duration < 1 || duration > 60) {
      socket.emit('error', { message: 'Durée invalide (1–60 tours requis)' })
      return
    }
    try {
      const combatSt = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
      await statusService.applyStunWithDuration(io, db, campaignId, tokenId, outcome, duration, combatSt?.current_turn ?? 1)
      console.log(`[WS] COMBAT_APPLY_STUN — is_stunned posé manuellement. token:${tokenId} outcome:${outcome} duration:${duration} campaign:${campaignId}`)
    } catch (err) {
      console.error('[WS] COMBAT_APPLY_STUN error:', err.message)
      socket.emit('error', { message: 'Erreur lors de l\'application de l\'étourdissement' })
    }
  })
}
