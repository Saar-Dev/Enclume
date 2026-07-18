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
import { LOCATION_LABELS, LOCATION_TO_SLOT } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
import {
  advanceTimeline, endTurn, pickNextTimelineStep, forfeitToken,
  triggerActNow, triggerDelayedPass,
  resolveMeleeAction, resolveReloadAction,
  resolveDroneAssaultAction, resolveAssaultAction,
  confirmMeleeDefense, confirmDamage,
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
        // Sous-états transitoires (une résolution précédente encore en attente) : `awaiting:true` sans
        // erreur, le client retentera — jamais traité comme un rejet dur (retour Saar, Session 159 :
        // conflation « en attente » / « bloqué définitivement » qui affichait le bouton Agir générique
        // sans fenêtre de modificateurs au lieu d'attendre). Retry déclenché côté client par le
        // changement de `subPhase` (CombatOverlay.jsx), pas seulement par COMBAT_ATTACK_RESULT.
        if (state?.sub_phase === 'AWAITING_DAMAGE' || state?.sub_phase === 'AWAITING_DEFENSE') {
          return callback({ awaiting: true })
        }
        // Message précis par sous-état plutôt qu'un « non autorisé » générique (retour Saar, Session
        // 158 — « dès qu'un truc marche pas, le système doit dire pourquoi »).
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: `Action non autorisée dans cet état de combat (phase:${state?.phase ?? '?'}, sous-état:${state?.sub_phase ?? '?'})` })
        return callback({ ok: false })
      }
      // 2. Guard stun — avant tout check LOS/range (STUN2)
      // Si assommé : auto-skip serveur + { ok: false, stunned: true } — débloque le pas figé
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
          await forfeitToken(campaignId, tokenId, state.current_turn)
          socket.emit(WS.COMBAT_DECLARE_ERROR, { stunned: true, statusCode: stunnedStatus?.status_code ?? 'stunned' })
          await advanceTimeline(io, campaignId, pendingMaps)
          return callback({ ok: false, stunned: true })
        }
      }
      // 3. Range check CaC — colonne 'type' (cohérent L.907 serveur)
      if (actionKey === 'melee') {
        const action = await db('combat_actions')
          .where({ campaign_id: campaignId, token_id: tokenId, type: 'melee', status: 'pending', turn_number: state.current_turn })
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
  // Joueur (ou GM pour PNJ) confirme le pas courant de l'échelle pour son token (docs/
  // PLAN_COMBAT_TIMELINE.md Lot B, §5). Un seul pas à la fois — s'il s'agit d'une série d'attaques
  // multiples, chaque attaque est une entrée distincte, reprise par un COMBAT_ACTION_CONFIRM séparé
  // quand advanceTimeline() la présente à son tour (potentiellement entrelacée avec d'autres tokens).
  // Payload : { tokenId, confirmedModifiers? }
  socket.on(WS.COMBAT_ACTION_CONFIRM, async ({ tokenId, confirmedModifiers }) => {
    console.log(`[DBG] COMBAT_ACTION_CONFIRM — tokenId:${tokenId} mods:${JSON.stringify(confirmedModifiers ?? null)}`)
    try {
      const state = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!canTransition(state?.phase ?? null, state?.sub_phase ?? null, 'COMBAT_ACTION_CONFIRM')) {
        console.warn(`[FSM] guard bloqué : ${state?.phase ?? null}|${state?.sub_phase ?? null} + COMBAT_ACTION_CONFIRM`)
        // Retour Saar Session 158 généralisé (§2 : « dès qu'un truc marche pas, le système doit dire
        // pourquoi ») — sans ce message, la fenêtre de modificateurs déjà ouverte côté client semble
        // simplement ne plus répondre au clic.
        if (state?.sub_phase === 'AWAITING_DEFENSE' || state?.sub_phase === 'AWAITING_DAMAGE') {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Une résolution précédente est encore en attente — patientez' })
        }
        return
      }
      // Guard : phase = RESOLUTION
      if (!state || state.phase !== 'RESOLUTION') {
        return
      }

      // Pas courant de l'échelle — source de vérité (remplace active_slot_idx, §5 Lot B). Le tour
      // obligatoire de fin de Tour (personnages encore delayed_waiting) passe par COMBAT_ACT_NOW/
      // COMBAT_DELAYED_PASS, jamais par ce handler.
      const step = await pickNextTimelineStep(campaignId, state.current_turn)
      if (!step || step.tokenId !== tokenId) {
        // Race légitime (§6ter point 3) : un personnage en délai a agi entre l'ouverture de cette
        // fenêtre de modificateurs et ce clic Confirmer, réordonnant l'échelle sous ses pieds — la
        // fenêtre reste ouverte côté client mais ne peut plus rien confirmer (retour Saar : « fenêtre
        // de modificateur non validable, Tour planté »). Message explicite plutôt qu'un no-op muet.
        const nextLabel = step ? (await db('tokens').where({ id: step.tokenId }).first())?.label ?? 'quelqu\'un d\'autre' : null
        socket.emit(WS.COMBAT_DECLARE_ERROR, {
          message: nextLabel
            ? `L'ordre a changé entre-temps — c'est maintenant au tour de ${nextLabel}. Cette fenêtre n'est plus d'actualité, fermez-la.`
            : 'Ce Tour est déjà terminé pour cette action — rien à confirmer.',
        })
        return
      }

      // Guard ownership — GM peut confirmer n'importe quel pas, joueur uniquement le sien
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
          console.log(`[STUN2] CONFIRM token ${tokenId} assommé — pas auto-skipé`)
          await forfeitToken(campaignId, tokenId, state.current_turn)
          socket.emit(WS.COMBAT_DECLARE_ERROR, { stunned: true, statusCode: stunnedStatus?.status_code ?? 'stunned' })
          await advanceTimeline(io, campaignId, pendingMaps)
          return
        }
      }

      // Actions simples (move/reload/micro — jamais d'entrée d'échelle, §5 « portée des entrées ») :
      // résolues une seule fois par Tour pour ce token, groupées avec son premier pas (has_resolved,
      // combat_roster — colonne existante depuis la migration 54, jamais câblée avant ce Lot).
      const rosterEntry = await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).first()
      let needsDefenseWait = false
      if (!rosterEntry?.has_resolved) {
      const simpleActions = await db('combat_actions')
        .where({ campaign_id: campaignId, token_id: tokenId, status: 'pending', turn_number: state.current_turn })
        .whereNotIn('type', ['melee', 'assault'])
        .orderBy('sequence', 'asc')
      for (const action of simpleActions) {
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
        } else if (action.type === 'reload') {
          await resolveReloadAction(io, socket, campaignId, character, action)
        }
        // micro / skip : resolved direct, pas d'effet V1
        await db('combat_actions')
          .where({ id: action.id })
          .update({ status: 'resolved', updated_at: db.fn.now() })
      }
      await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .update({ has_resolved: true, updated_at: db.fn.now() })
      }

      // Pas complexe dû (melee ou assault) — exactement l'entrée désignée par le pas courant, jamais
      // « toutes les actions restantes » (§5 Lot B : la récursion ad hoc disparaît).
      if (step.kind === 'entry') {
        const action = await db('combat_actions').where({ id: step.entry.combat_action_id }).first()
        await db('combat_timeline_entries').where({ id: step.entry.id }).update({ status: 'resolved', resolved_at: db.fn.now(), updated_at: db.fn.now() })
        await db('combat_actions').where({ id: action.id }).update({ status: 'resolved', updated_at: db.fn.now() })

        // Isolé du try/catch englobant (Session 158, retour Saar) : l'entrée est déjà marquée
        // 'resolved' ci-dessus — une exception ici NE DOIT JAMAIS laisser l'échelle bloquée en
        // silence (symptôme observé : « plantage du tour de combat, aucun message d'erreur, rien » —
        // le catch englobant avalait l'erreur côté serveur uniquement et n'appelait plus
        // advanceTimeline, gelant la Résolution jusqu'à la prochaine reconnexion). Toute erreur est
        // maintenant expliquée en chat (cf. retour Saar §2 : « dès qu'un truc marche pas, le système
        // doit dire pourquoi ») et l'échelle avance quand même.
        console.log(`[DBG] COMBAT_ACTION_CONFIRM — avant résolution entrée ${step.entry.id} type:${action.type} token:${tokenId}`)
        try {
          if (action.type === 'assault') {
            if (!confirmedModifiers && character.type !== 'drone') {
              console.warn(`[WS] COMBAT_ACTION_CONFIRM — assault sans confirmedModifiers. token:${tokenId}`)
              io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
                username: token.label ?? 'ce personnage',
                message: 'Tir non résolu — aucun modificateur reçu (fenêtre de modificateurs jamais ouverte côté client). L\'action est passée sans jet, prévenez le MJ.',
              })
            } else {
              const assaultResult = await resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps)
              console.log(`[DBG] COMBAT_ACTION_CONFIRM — resolveAssaultAction terminé token:${tokenId}`)
              if (assaultResult) await flushEmissions(io, socket, campaignId, assaultResult.emissions)
            }
            // Pas de blocage : l'attaque à distance elle-même est complète, la confirmation des dégâts
            // (AWAITING_DAMAGE) est asynchrone et ne retient pas la suite de l'échelle (comportement
            // préexistant, inchangé par ce Lot).
          } else if (action.type === 'melee') {
            if (character.type === 'drone') {
              const droneResult = await resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps)
              if (droneResult) await flushEmissions(io, socket, campaignId, droneResult.emissions)
            } else {
              const meleeResult = await resolveMeleeAction(io, campaignId, action, character, confirmedModifiers, pendingMaps)
              if (meleeResult) {
                await flushEmissions(io, socket, campaignId, meleeResult.emissions)
                needsDefenseWait = meleeResult.suspend
              }
            }
          }
        } catch (resolveErr) {
          console.error(`[WS] COMBAT_ACTION_CONFIRM — erreur en résolvant l'entrée ${step.entry.id} (token:${tokenId}, type:${action.type}):`, resolveErr)
          io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
            username: token.label ?? 'ce personnage',
            message: `Erreur interne en résolvant cette action (${resolveErr.message}) — le Tour continue, résultat éventuellement incomplet, prévenez le MJ`,
          })
        }
        console.log(`[DBG] COMBAT_ACTION_CONFIRM — bloc résolution entrée ${step.entry.id} terminé (avec ou sans erreur), token:${tokenId}`)
      }

      // Pas suivant — sauf si on attend le jet de défense d'un PJ (le pas courant reste dû). Toujours
      // exécuté même après une erreur de résolution ci-dessus : l'échelle ne doit jamais rester bloquée.
      if (!needsDefenseWait) {
        console.log(`[DBG] COMBAT_ACTION_CONFIRM — avant advanceTimeline final, token:${tokenId}`)
        await advanceTimeline(io, campaignId, pendingMaps)
        console.log(`[DBG] COMBAT_ACTION_CONFIRM — après advanceTimeline final, token:${tokenId}`)
      }
    } catch (err) {
      console.error('[WS] COMBAT_ACTION_CONFIRM error:', err)
    }
  })

  // ─── COMBAT_DAMAGE_CONFIRM — PJ lance les dés (calcul serveur) ────────────
  socket.on(WS.COMBAT_DAMAGE_CONFIRM, async ({ tokenId }) => {
    const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
    if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_DAMAGE_CONFIRM')) {
      console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_DAMAGE_CONFIRM`)
      return
    }
    await confirmDamage(io, campaignId, tokenId, socket, { requesterUserId: user.id, isGm })
  })

  // ─── COMBAT_MELEE_DEFENSE_CONFIRM — défenseur PJ valide son jet ───────────
  // Résout l'opposition (rollAttaque vs rollDefense), gère les dégâts, avance le slot.
  socket.on(WS.COMBAT_MELEE_DEFENSE_CONFIRM, async ({ tokenId }) => {
    const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
    if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_MELEE_DEFENSE_CONFIRM')) {
      console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_MELEE_DEFENSE_CONFIRM`)
      return
    }
    await confirmMeleeDefense(io, campaignId, tokenId, pendingMaps, socket, { requesterUserId: user.id, requesterUsername: user.username, isGm })
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

  // ─── COMBAT_ACT_NOW — « Agir maintenant » (docs/PLAN_COMBAT_TIMELINE.md §1/§6ter point 3) ────────
  // PJ pour son propre token en delayed_waiting, ou GM pour n'importe lequel de ses PNJ (§1, Q1).
  socket.on(WS.COMBAT_ACT_NOW, async ({ tokenId }) => {
    console.log(`[DBG] COMBAT_ACT_NOW — reçu pour token:${tokenId}`)
    try {
      const state = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!canTransition(state?.phase ?? null, state?.sub_phase ?? null, 'COMBAT_ACT_NOW')) {
        console.warn(`[FSM] guard bloqué : ${state?.phase ?? null}|${state?.sub_phase ?? null} + COMBAT_ACT_NOW`)
        return
      }
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token?.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character) return
      if (!isGm && character.user_id !== user.id) return
      const result = await triggerActNow(io, campaignId, tokenId, pendingMaps)
      console.log(`[DBG] COMBAT_ACT_NOW — triggerActNow(token:${tokenId}) → ${result}`)
      if (result === 'too_early') {
        socket.emit(WS.COMBAT_DECLARE_ERROR, {
          username: character.name ?? token.label ?? 'ce personnage',
          message: 'Pas encore possible — Retarder ne permet d\'agir qu\'à partir de sa propre phase d\'Initiative, jamais avant. Réessayez plus tard dans le Tour.',
        })
      }
    } catch (err) {
      console.error('[WS] COMBAT_ACT_NOW error:', err.message)
    }
  })

  // ─── COMBAT_DELAYED_PASS — « Passer » au tour obligatoire de fin de Tour (§6 point 2) ────────────
  socket.on(WS.COMBAT_DELAYED_PASS, async ({ tokenId }) => {
    console.log(`[DBG] COMBAT_DELAYED_PASS — reçu pour token:${tokenId}`)
    try {
      const state = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!canTransition(state?.phase ?? null, state?.sub_phase ?? null, 'COMBAT_DELAYED_PASS')) {
        console.warn(`[FSM] guard bloqué : ${state?.phase ?? null}|${state?.sub_phase ?? null} + COMBAT_DELAYED_PASS`)
        return
      }
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token?.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character) return
      if (!isGm && character.user_id !== user.id) return
      await triggerDelayedPass(io, campaignId, tokenId, pendingMaps)
    } catch (err) {
      console.error('[WS] COMBAT_DELAYED_PASS error:', err.message)
    }
  })
}
