import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition } from '../lib/combatFSM.js'
import { skipPlayer, startResolutionPhase } from './socketCombatHelpers.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'

export function registerAnnouncementHandlers(io, socket, context, pendingMaps) {
  const { campaignId, user, isGm } = context

  // ─── COMBAT:ACTION_DECLARE v2 ─────────────────────────────────────────
  // Joueur (ou GM pour un PNJ) déclare son action pendant la phase ANNOUNCEMENT.
  // Payload v2 : { tokenId, state:{position,weapon,fire_mode,cover,vitesse}, mapActions:{move?,attack?,melee?,multi?,interact?}, quick:{observer,reperer,phrase} }
  socket.on(WS.COMBAT_ACTION_DECLARE, async ({ tokenId, state, mapActions, quick }) => {
    try {
      const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_ACTION_DECLARE')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_ACTION_DECLARE`)
        return
      }
      if (!tokenId || !state) return

      // Valeurs autorisées par état
      const VALID_STATES = {
        position:     ['standing', 'crouching', 'prone'],
        weapon:       ['holstered', 'ready', 'drawn'],
        fire_mode:    ['cc', 'rc', 'rl'],
        cover:        ['exposed', 'partial', 'important'],
        vitesse:      ['normal', 'delayed', 'rushed'],
        combat_mode:  ['normal', 'offensif', 'charge', 'defensif', 'retraite'],
      }
      for (const [k, vals] of Object.entries(VALID_STATES)) {
        if (state[k] && !vals.includes(state[k])) return
      }

      // PC33 — coordonnées déplacement obligatoires si move (coords DB PE14)
      if (mapActions?.move) {
        const px = parseInt(mapActions.move.targetPosX)
        const py = parseInt(mapActions.move.targetPosY)
        const pz = parseInt(mapActions.move.targetPosZ ?? 0)
        if (isNaN(px) || isNaN(py) || isNaN(pz)) {
          socket.emit('error', { message: 'Coordonnées de déplacement invalides (PC33)' })
          return
        }
      }

      // Validation ownership (joueur pour PJ, GM pour PNJ)
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return
      // PC27 — entité de décor : ne déclare pas d'action en combat
      if (!token.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character) return
      if (character.type === 'pnj') {
        if (!isGm) return
      } else if (character.type === 'drone') {
        const isOwner = character.user_id && character.user_id === user.id
        if (!isGm && !isOwner) return
      } else {
        if (character.user_id !== user.id) return
      }

      const entry = await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .first()
      if (!entry || entry.has_announced) return

      // LdB p.212 — guard ordre d'annonce : seul le slot actuel (base_ini ASC) peut déclarer
      const announceState = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!announceState || announceState.phase !== 'ANNOUNCEMENT') return
      const firstNonAnnounced = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
        .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
        .first()
      if (!firstNonAnnounced || firstNonAnnounced.token_id !== tokenId) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Ce n'est pas encore votre tour de déclarer" })
        return
      }

      // Stun guard — is_stunned lit depuis token_statuses (source unique post-Sprint 14-0)
      const stunRow = await db('token_statuses').where({ token_id: tokenId, status_code: 'stunned' }).first()
      if (stunRow) {
        if (mapActions?.attack) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — ne peut pas attaquer" })
          return
        }
        if (mapActions?.melee?.length > 0) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — ne peut pas attaquer au corps à corps" })
          return
        }
        const ak = mapActions?.move?.action_key
        if (ak === 'move_rapide' || ak === 'move_max') {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — allure maximale : Moyenne" })
          return
        }
      }

      const isDrone = character.type === 'drone'

      // PC22 — arme requise pour assaut + PC23 (TIR_AUTOMATIQUE pour RC/RL)
      let assaultWeaponRefRange = null
      if (mapActions?.attack) {
        if (isDrone) {
          // Drone : validation droneWeaponInvId contre drone_weapons
          const { droneWeaponInvId } = mapActions.attack
          if (!droneWeaponInvId) {
            socket.emit('error', { message: 'Arme drone requise pour un assaut (PC22-D)' })
            return
          }
          const droneWeapon = await db('drone_weapons')
            .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
            .where({ 'drone_weapons.id': droneWeaponInvId, 'drone_weapons.character_id': character.id })
            .select('drone_weapons.*', 'ref_equipment.range as ref_range')
            .first()
          if (!droneWeapon) {
            socket.emit('error', { message: "Arme drone introuvable (PC22-D)" })
            return
          }
          assaultWeaponRefRange = droneWeapon.ref_range ?? null
        } else {
          // Humanoïde : validation char_inventory + PC23
          const { weaponInvId } = mapActions.attack
          if (!weaponInvId) {
            socket.emit('error', { message: 'Arme requise pour un assaut (PC22)' })
            return
          }
          const weapon = await db('char_inventory')
            .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where({ 'char_inventory.id': weaponInvId, 'char_inventory.character_id': character.id })
            .select('char_inventory.slot', 'char_inventory.ammo_remaining', 'ref_equipment.range as ref_range', 'ref_equipment.fire_mode as ref_fire_mode')
            .first()
          if (!weapon) {
            socket.emit('error', { message: "Arme introuvable dans l'inventaire (PC22)" })
            return
          }
          if (!['MG', 'MD', '2M', 'Tr'].includes(weapon.slot)) {
            socket.emit('error', { message: "L'arme doit être équipée (slot arme) (PC22)" })
            return
          }
          // fire_mode vient de state.fire_mode (v2) — comparaison insensible à la casse
          const fireMode = (state.fire_mode ?? 'cc').toUpperCase()
          if (weapon.ref_fire_mode && !weapon.ref_fire_mode.toUpperCase().includes(fireMode)) {
            socket.emit('error', { message: `Mode de tir ${fireMode} non disponible pour cette arme` })
            return
          }
          assaultWeaponRefRange = weapon.ref_range ?? null
          // PC23 — TIR_AUTOMATIQUE requis pour RC/RL
          if (fireMode === 'RC' || fireMode === 'RL') {
            const sheet = await db('char_sheet').where({ character_id: character.id }).first()
            const autoSkill = sheet
              ? await db('char_skills').where({ char_sheet_id: sheet.id, skill_id: 'TIR_AUTOMATIQUES' }).first()
              : null
            if (!autoSkill) {
              socket.emit('error', { message: 'Compétence Tir Automatique requise (PC23)' })
              return
            }
          }
          // Vérification munitions ANNOUNCEMENT (MANUELSYSCOMBAT §4)
          // ammo_remaining null = tracking désactivé (arme sans chargeur) → pas de vérification
          const bulletCount = mapActions.attack.bulletCount ?? 1
          if (weapon.ammo_remaining !== null && weapon.ammo_remaining < bulletCount) {
            let pnjUnlimited = false
            if (character.type === 'pnj') {
              const settings = await getCampaignSettings(db, campaignId)
              pnjUnlimited = settings.pnj_unlimited_ammo
            }
            if (!pnjUnlimited) {
              socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Munitions insuffisantes — rechargez d'abord" })
              return
            }
          }
        }
      }

      // Matrices de coût de transition INI (miroir de STATE_DEFS dans combatSections.js)
      const STATE_COSTS = {
        position:  { standing: { crouching: -3, prone: -5 }, crouching: { standing: -3, prone: -5 }, prone: { standing: -10, crouching: -10 } },
        weapon:    { holstered: { ready: -3, drawn: -5 }, ready: { holstered: -5, drawn: -3 }, drawn: { holstered: -10, ready: -3 } },
        fire_mode: { cc: { rc: -3, rl: -3 }, rc: { cc: -3, rl: -3 }, rl: { cc: -3, rc: -3 } },
        cover:     {},
        vitesse:   { delayed: { normal: 0, rushed: 3 }, normal: { delayed: 0, rushed: 3 }, rushed: { delayed: 0, normal: 0 } },
      }
      const transitionCost = (costs, from, to) => from === to ? 0 : (costs?.[from]?.[to] ?? 0)

      let iniDelta = 0
      if (!isDrone) {
        for (const key of ['position', 'weapon', 'fire_mode', 'cover', 'vitesse']) {
          const from = entry['state_' + key]
          const to   = state[key] ?? from
          iniDelta += transitionCost(STATE_COSTS[key], from, to)
        }
        // Charge/Retraite : déplacement gratuit — override ini_mod serveur (non trusté client)
        const freeMove = (state.combat_mode === 'charge' || state.combat_mode === 'retraite') && !!mapActions?.move
        if (mapActions?.move)  iniDelta += freeMove ? 0 : (mapActions.move.ini_mod ?? 0)
        if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) {
          iniDelta += -3
          if (mapActions.melee.length > 1) iniDelta += -5
        }
        if (mapActions?.attack?.cover_shot) {
          iniDelta += state.cover === 'important' ? -5 : -3
        }
        iniDelta += (quick?.observer ?? 0) * -5
        iniDelta += (quick?.reperer  ?? 0) * -5
        if (quick?.phrase) iniDelta += -3
      }

      // Construction des lignes combat_actions (PC32 — sequence attribué serveur)
      const getType = (key) => {
        if (key === 'assault') return 'assault'
        if (key === 'move_lente') return 'move_short'
        if (key.startsWith('move_')) return 'move_long'
        return 'micro'
      }

      const actionRows = []

      if (mapActions?.move) {
        const px = parseInt(mapActions.move.targetPosX)
        const py = parseInt(mapActions.move.targetPosY)
        const pz = parseInt(mapActions.move.targetPosZ ?? 0)
        const ak = mapActions.move.action_key
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: ak, type: getType(ak), sequence: 1,
          target_pos_x: px, target_pos_y: py, target_pos_z: pz,
          modifiers: JSON.stringify({ ini_mod: mapActions.move.ini_mod ?? 0 }),
          status: 'pending',
        })
      }

      if (mapActions?.attack) {
        const { weaponInvId, droneWeaponInvId, targetTokenId, bulletCount, fireModeBonusComp, fireModeBonusDmg, isDualWield, dualWieldBonusComp } = mapActions.attack
        actionRows.push({
          campaign_id:          campaignId, token_id: tokenId,
          action_key:           'assault', type: 'assault', sequence: 3,
          weapon_inv_id:        isDrone ? null : (weaponInvId ?? null),
          drone_weapon_inv_id:  isDrone ? (droneWeaponInvId ?? null) : null,
          target_token_id:      targetTokenId ?? null,
          fire_mode:            state.fire_mode ?? null,
          bullet_count:         bulletCount ?? null,
          fire_mode_bonus_comp: fireModeBonusComp ?? null,
          fire_mode_bonus_dmg:  fireModeBonusDmg ?? null,
          modifiers:            JSON.stringify({ ini_mod: 0, ref_range: assaultWeaponRefRange, dual_wield: isDualWield ?? false, dual_wield_bonus_comp: dualWieldBonusComp ?? 0 }),
          status:               'pending',
        })
      }

      // Phase 1 : intention enregistrée sans validation distance (vérifiée en Phase 2)
      // mapActions.melee est un array : [{ targetTokenId, weaponInvId?, droneWeaponInvId? }, ...]
      if (Array.isArray(mapActions?.melee)) {
        for (const { targetTokenId: meleeTargetId, weaponInvId: meleeWeaponId, droneWeaponInvId: meleeDroneWeaponId } of mapActions.melee) {
          if (meleeTargetId) {
            actionRows.push({
              campaign_id: campaignId, token_id: tokenId,
              action_key: 'melee', type: 'melee', sequence: 3,
              weapon_inv_id:       meleeDroneWeaponId ? null : (meleeWeaponId ?? null),
              drone_weapon_inv_id: meleeDroneWeaponId ?? null,
              target_token_id: meleeTargetId,
              modifiers: JSON.stringify({ ini_mod: -3 }),
              status: 'pending',
            })
          }
        }
      }

      if (mapActions?.interact) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'interact', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: 0 }), status: 'pending',
        })
      }

      if (mapActions?.reload) {
        const reloadData = typeof mapActions.reload === 'object' ? mapActions.reload : {}
        actionRows.push({
          campaign_id:  campaignId, token_id: tokenId,
          action_key:   'reload', type: 'reload', sequence: 3,
          weapon_inv_id: reloadData.weapon_inv_id ?? null,
          modifiers:    JSON.stringify({ ini_mod: 0, ammo_item_id: reloadData.ammo_item_id ?? null }),
          status:       'pending',
        })
      }

      if ((quick?.observer ?? 0) > 0) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'observer', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: quick.observer * -5 }), status: 'pending',
        })
      }

      if ((quick?.reperer ?? 0) > 0) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'reperer', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: quick.reperer * -5 }), status: 'pending',
        })
      }

      if (quick?.phrase) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'phrase', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: -3 }), status: 'pending',
        })
      }

      // Guard : CaC déclaré sans aucune cible → has_announced non settée, erreur explicite
      if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0
          && !mapActions.melee.some(m => m.targetTokenId)) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Corps à corps : sélectionner une cible avant de valider.' })
        return
      }

      // UPDATE combat_roster — états + initiative + has_announced
      const [updated] = await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .update({
          state_position:    state.position     ?? entry.state_position,
          state_weapon:      state.weapon       ?? entry.state_weapon,
          state_fire_mode:   state.fire_mode ?? entry.state_fire_mode,
          state_cover:       state.cover        ?? entry.state_cover,
          state_vitesse:     state.vitesse      ?? entry.state_vitesse,
          state_combat_mode: state.combat_mode  ?? entry.state_combat_mode,
          initiative:        db.raw('initiative + ?', [iniDelta]),
          has_announced:     true,
          updated_at:        db.fn.now(),
        })
        .returning(['initiative'])

      const updatedInitiative = updated.initiative

      if (actionRows.length > 0) await db('combat_actions').insert(actionRows)

      // Dériver actionType pour le broadcast
      let actionType = 'micro'
      if (mapActions?.attack)      actionType = 'assault'
      else if (mapActions?.move)   actionType = getType(mapActions.move.action_key)
      else if (mapActions?.melee)  actionType = 'melee'
      else if (mapActions?.reload) actionType = 'reload'

      io.to(campaignId).emit(WS.COMBAT_ACTION_DECLARED, {
        tokenId,
        actionType,
        initiative_score: updatedInitiative,
        initiative:       updatedInitiative,
        // Coords PE14 destination déplacement (pour ghost spectateurs)
        moveTarget: mapActions?.move
          ? { x: mapActions.move.targetPosX, y: mapActions.move.targetPosY, z: mapActions.move.targetPosZ }
          : null,
        // Token cible (tir ou CaC, pour ligne d'annonce spectateurs)
        attackTargetId: mapActions?.attack?.targetTokenId
          ?? mapActions?.melee?.[0]?.targetTokenId
          ?? null,
      })

      // Nettoyer le timer auto-skip si actif
      const campaignTimersMap = pendingMaps.combatTimers.get(campaignId)
      if (campaignTimersMap?.has(tokenId)) {
        clearTimeout(campaignTimersMap.get(tokenId))
        campaignTimersMap.delete(tokenId)
      }

      // Purger le preview éphémère — le joueur a confirmé sa déclaration
      pendingMaps.combatPreviews.delete(campaignId)

      // PC13 — tous annoncés → phase Résolution, sinon émettre le slot suivant (LdB p.212)
      const [{ count }] = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false })
        .count('* as count')
      if (parseInt(count) === 0) {
        await startResolutionPhase(io, campaignId, pendingMaps)
      } else {
        const nextAnnounceSlot = await db('combat_roster')
          .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
          .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
          .first()
        if (nextAnnounceSlot) {
          io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: nextAnnounceSlot.token_id })
        }
      }

      console.log(`[WS] combat:action_declare v2 — ${user.username} state:${JSON.stringify(state)} iniDelta:${iniDelta} -> ${updatedInitiative}`)
    } catch (err) {
      console.error('[WS] combat:action_declare error:', err.message)
    }
  })

  // ─── COMBAT:SKIP_PLAYER ───────────────────────────────────────────────
  // GM passe le tour d'un joueur pendant la phase ANNOUNCEMENT.
  // Payload : { tokenId }
  socket.on(WS.COMBAT_SKIP_PLAYER, async ({ tokenId }) => {
    if (!isGm) return
    try {
      const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_SKIP_PLAYER')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_SKIP_PLAYER`)
        return
      }
      // Nettoyer le timer auto-skip si actif
      const campaignTimersMap = pendingMaps.combatTimers.get(campaignId)
      if (campaignTimersMap?.has(tokenId)) {
        clearTimeout(campaignTimersMap.get(tokenId))
        campaignTimersMap.delete(tokenId)
      }
      await skipPlayer(io, campaignId, tokenId, pendingMaps)
    } catch (err) {
      console.error('[WS] combat:skip_player error:', err.message)
    }
  })

  // ─── COMBAT:ANNOUNCE_PREVIEW — Preview éphémère en cours de déclaration ─
  // PJ émet ses sélections en cours (debounce client). Relay sans DB write.
  // Payload : { tokenId, actions[], assaultTargetId, meleeTargetIds[], moveDestination, combatMode }
  socket.on(WS.COMBAT_ANNOUNCE_PREVIEW, async (payload) => {
    if (!payload?.tokenId) return
    try {
      const token = await db('tokens').where({ id: payload.tokenId }).first()
      if (!token?.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character || character.user_id !== user.id) return
      pendingMaps.combatPreviews.set(campaignId, payload)
      io.to(campaignId).emit(WS.COMBAT_ANNOUNCE_PREVIEW, payload)
    } catch (err) {
      console.error('[WS] COMBAT_ANNOUNCE_PREVIEW error:', err.message)
    }
  })
}
