import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { getMrTable, getModifier } from '../lib/mrTable.js'
import * as woundService from '../lib/woundService.js'
import * as statusService from '../lib/statusService.js'
import * as damageService from '../lib/damageService.js'
import { canTransition, setFSMSubPhase } from '../lib/combatFSM.js'
import { checkCombatLOS } from '../lib/losService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { getMutationEffects } from '../services/mutationService.js'
import {
  calcSkillTotal, calcAttributeNA,
  calcWoundPenalty, calcEncumbrancePenalty,
  calcResistanceDommages, calcResistanceArmure, calcCarenceArmure,
  getModDom, calcDroneRD, calcDroneDegatsNets,
} from '../lib/charStats.js'
import { isCaseOccupied, collisionMoveToken } from '../lib/redis.js'
import { SLOT_TO_WOUND_LOCATION, LOCATION_LABELS, LOC_TABLE } from '../../../shared/armorConstants.js'


// ─── Breakdown jets de dé — tables et labels ────────────────────────────────
const PORTEE_MOD_COMP = {
  bout_portant: 5, courte: 0, moyenne: -5, longue: -10, extreme: -15,
}
const SITUATION_MODS = {
  cible_immobile: 3,
  cible_allure_moyenne: -3, cible_allure_rapide: -5, cible_allure_maximale: -7,
  tireur_allure_lente: -3, tireur_allure_moyenne: -5, tireur_allure_rapide: -7, tireur_allure_maximale: -99,
  couverture_partielle: -3, couverture_importante: -5,
  obscurite_legere: -3, obscurite_importante: -5, obscurite_totale: -99,
  // CaC §6.2 — préfixe cac_ évite les collisions avec keys ranged
  cac_attaquant_cote: -3,
  cac_attaquant_au_sol: -5,
  cac_espace_confine: -3,
  cac_espace_tres_confine: -5,
  cac_position_avantageuse: 3,
  cac_main_non_directrice: -5,
  // cac_terrain_instable : compétence limitative — traité séparément (Math.min)
}
const TAILLE_MODS = {
  minuscule: -10, tres_petite: -5, petite: -3, moyenne: 0,
  grande: 3, tres_grande: 5, enorme: 10, gigantesque: 15,
}
const SITUATION_LABELS = {
  cible_immobile:        'Cible immobile',
  cible_allure_moyenne:  'Cible allure moyenne',
  cible_allure_rapide:   'Cible allure rapide',
  cible_allure_maximale: 'Cible allure maximale',
  tireur_allure_lente:   'Tireur allure lente',
  tireur_allure_moyenne: 'Tireur allure moyenne',
  tireur_allure_rapide:  'Tireur allure rapide',
  couverture_partielle:  'Couverture partielle (50%)',
  couverture_importante: 'Couverture importante (75%)',
  obscurite_legere:      'Obscurité légère',
  obscurite_importante:  'Obscurité importante',
}
const PORTEE_LABELS = {
  bout_portant: 'À bout portant', courte: 'Portée courte',
  moyenne:      'Portée moyenne', longue: 'Portée longue', extreme: 'Portée extrême',
}
const TAILLE_LABELS = {
  minuscule:    'Cible minuscule (~30cm)', tres_petite: 'Cible très petite (~50cm)',
  petite:       'Cible petite (~1m)',      moyenne:     'Cible taille humaine',
  grande:       'Cible grande (~3m)',      tres_grande: 'Cible très grande (~5m)',
  enorme:       'Cible énorme (~7m)',      gigantesque: 'Cible gigantesque (10m+)',
}
export const COMBAT_MODE_LABELS = {
  offensif: 'Mode offensif', charge:   'Mode charge',
  defensif: 'Mode défensif', retraite: 'Mode retraite',
}

// ─── Helper — démarrer les timers auto-skip pour la phase ANNONCE ─────────────
// PC17 : skip uniquement si timerSec > 0. Exclut PNJs et tokens du GM (gmUserId).
export async function startAnnouncementTimers(io, campaignId, timerSec, gmUserId, pendingMaps) {
  if (!timerSec || timerSec <= 0) return
  const rosterEntries = await db('combat_roster')
    .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
  if (!pendingMaps.combatTimers.has(campaignId)) pendingMaps.combatTimers.set(campaignId, new Map())
  const campaignTimersMap = pendingMaps.combatTimers.get(campaignId)
  for (const entry of rosterEntries) {
    const token = await db('tokens').where({ id: entry.token_id }).first()
    if (!token?.character_id) continue
    const character = await db('characters').where({ id: token.character_id }).first()
    if (!character || character.user_id === gmUserId) continue  // PNJ ou GM → pas de timer
    const timeoutId = setTimeout(async () => {
      await skipPlayer(io, campaignId, entry.token_id, pendingMaps)
    }, timerSec * 1000)
    campaignTimersMap.set(entry.token_id, timeoutId)
  }
}

// ─── Helper — skip d'un participant pendant la phase ANNONCE ──────────────────
// Appelé par COMBAT_SKIP_PLAYER (GM) et par le timer auto-skip (PC17).
// Race condition guard : re-vérifie has_announced avant d'agir.
export async function skipPlayer(io, campaignId, tokenId, pendingMaps) {
  try {
    const entry = await db('combat_roster')
      .where({ campaign_id: campaignId, token_id: tokenId })
      .first()
    if (!entry || entry.has_announced) return

    await db('combat_roster')
      .where({ campaign_id: campaignId, token_id: tokenId })
      .update({ has_announced: true, updated_at: db.fn.now() })

    // Insérer action 'skip' en base
    await db('combat_actions').insert({
      campaign_id: campaignId,
      token_id: tokenId,
      type: 'skip',
      action_key: 'skip',
      sequence: 99,
      status: 'skipped',
    })

    // Bug 2 fix : tokenLabel dans le payload — évite stale closure client
    const token = await db('tokens').where({ id: tokenId }).first()
    const tokenLabel = token?.label ?? 'Inconnu'

    // Bug 1 fix : émettre COMBAT_TURN_SKIPPED AVANT de vérifier PC13
    io.to(campaignId).emit(WS.COMBAT_TURN_SKIPPED, { tokenId, tokenLabel })

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
  } catch (err) {
    console.error('[WS] skipPlayer error:', err.message)
  }
}

// ─── Helper — transition vers la phase RÉSOLUTION ─────────────────────────────
// Appelé automatiquement quand tous les participants ont annoncé (PC13).
// Sprint 2 : stub — met à jour la phase et broadcast COMBAT_PHASE_CHANGED.
// Sprint 3/4 : résolution pas-à-pas par initiative_score DESC.
export async function startResolutionPhase(io, campaignId, pendingMaps) {
  try {
    await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({ phase: 'RESOLUTION', active_slot_idx: 0, updated_at: db.fn.now() })
    await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')

    const [announcedRoster, pendingActions, fullRoster] = await Promise.all([
      db('combat_roster')
        .where({ campaign_id: campaignId, status: 'active', has_announced: true })
        .orderBy('initiative', 'desc'),
      db('combat_actions')
        .where({ campaign_id: campaignId, status: 'pending' })
        .orderBy('sequence', 'asc'),
      db('combat_roster')
        .where({ campaign_id: campaignId })
        .orderBy('initiative', 'desc'),
    ])

    const broadcastRoster = fullRoster.map(({ surprise_roll: _sr, ...rest }) => rest)

    pendingMaps.combatPreviews.delete(campaignId)

    io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, {
      phase: 'RESOLUTION',
      roster: broadcastRoster,
      actions: pendingActions,
    })

    io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, {
      activeSlotIdx: 0,
      tokenId: announcedRoster[0]?.token_id ?? null,
    })

    console.log(`[WS] startResolutionPhase — campagne ${campaignId}`)
  } catch (err) {
    console.error('[WS] startResolutionPhase error:', err.message)
  }
}

// ─── Helper — avancer au slot suivant pendant la phase RÉSOLUTION ─────────────
// nextIdx >= slots.length → fin de tour (endTurn).
// Sinon : met à jour active_slot_idx en DB + broadcast COMBAT_SLOT_ADVANCED.
export async function advanceSlot(io, campaignId, slots, nextIdx, pendingMaps) {
  try {
    if (nextIdx >= slots.length) {
      await endTurn(io, campaignId, pendingMaps)
      return
    }
    await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({ active_slot_idx: nextIdx, updated_at: db.fn.now() })
    io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, {
      activeSlotIdx: nextIdx,
      tokenId: slots[nextIdx].token_id,
    })
  } catch (err) {
    console.error('[WS] advanceSlot error:', err.message)
  }
}

// ─── Helper — fin de tour : reset roster + actions, retour ANNOUNCEMENT ──────
// PC18 : 1 seul UPDATE bulk sur combat_roster.
// PC28 : DELETE combat_actions — queue nettoyée entre chaque tour.
export async function endTurn(io, campaignId, pendingMaps) {
  try {
    // PC18 — reset announced/resolved + états per-tour (position/cover/vitesse)
    await db('combat_roster')
      .where({ campaign_id: campaignId, status: 'active' })
      .update({
        has_announced:     false,
        has_resolved:      false,
        state_position:    'standing',
        state_cover:       'exposed',
        state_vitesse:     'normal',
        state_combat_mode: 'normal',
        updated_at:        db.fn.now(),
      })

    // PC28 — vider la queue des actions
    await db('combat_actions').where({ campaign_id: campaignId }).delete()

    // Incrémenter le tour, retour à ANNOUNCEMENT
    const [updatedState] = await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({
        phase: 'ANNOUNCEMENT',
        current_turn: db.raw('current_turn + 1'),
        active_slot_idx: 0,
        updated_at: db.fn.now(),
      })
      .returning(['action_timer_sec', 'current_turn'])

    // Purge universelle — statuts expirés ce tour (stunned, unconscious, surprised…)
    const newTurn = updatedState?.current_turn ?? 1
    const rosterTids = await db('combat_roster').where({ campaign_id: campaignId }).pluck('token_id')
    if (rosterTids.length > 0) {
      const expiredRows = await db('token_statuses')
        .whereIn('token_id', rosterTids)
        .whereNotNull('expires_at_turn')
        .where('expires_at_turn', '<=', newTurn)
        .select('token_id', 'status_code')
      if (expiredRows.length > 0) {
        const expiredStunIds = [...new Set(
          expiredRows.filter(r => r.status_code === 'stunned' || r.status_code === 'unconscious').map(r => r.token_id)
        )]
        const allExpiredIds = [...new Set(expiredRows.map(r => r.token_id))]
        await db('token_statuses')
          .whereIn('token_id', rosterTids)
          .whereNotNull('expires_at_turn')
          .where('expires_at_turn', '<=', newTurn)
          .delete()
        for (const token_id of allExpiredIds) {
          await statusService.emitTokenStatusUpdated(io, db, campaignId, token_id)
        }
        for (const token_id of expiredStunIds) {
          io.to(campaignId).emit(WS.COMBAT_STUN_EXPIRED, { tokenId: token_id })
          console.log(`[WS] endTurn — étourdissement expiré. token:${token_id} turn:${newTurn}`)
        }
      }
    }

    const roster = await db('combat_roster')
      .where({ campaign_id: campaignId })
      .orderBy('initiative', 'desc')
    const broadcastRoster = roster.map(({ surprise_roll: _sr, ...rest }) => rest)

    await setFSMSubPhase(db, campaignId, null)
    io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'ANNOUNCEMENT', roster: broadcastRoster })

    // LdB p.212 — émettre le premier slot d'annonce du nouveau tour (base_ini ASC)
    const firstAnnounceSlotNewTurn = await db('combat_roster')
      .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
      .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
      .first()
    if (firstAnnounceSlotNewTurn) {
      io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: firstAnnounceSlotNewTurn.token_id })
    }

    // Relancer les timers pour le nouveau tour
    const gmMember = await db('campaign_members')
      .where({ campaign_id: campaignId, role: 'gm' })
      .select('user_id')
      .first()
    await startAnnouncementTimers(io, campaignId, updatedState?.action_timer_sec ?? 0, gmMember?.user_id, pendingMaps)

    console.log(`[WS] endTurn — campagne ${campaignId}`)
  } catch (err) {
    console.error('[WS] endTurn error:', err.message)
  }
}

// ─── MULTI-ADVERSAIRES — helpers ─────────────────────────────────────────────
// Malus LdB p.224 : confronté à N adversaires distincts en CaC.
// V1 : PNJ = ennemi du PJ, PJ = ennemi du PNJ. PNJ alliés non distingués.
export function multiAdversaryMalus(n) {
  return n >= 4 ? -10 : n === 3 ? -7 : n === 2 ? -5 : 0
}

// Compte les tokens ennemis actifs (enemyType) dans le roster à portée de tokenPos.
// Portée = 3m + allonge maximale de l'adversaire (arme de contact équipée).
// excludeId : token à exclure (soi-même).
export function countAdversaires(tokenPos, rosterTokens, excludeId, enemyType) {
  let count = 0
  for (const t of rosterTokens) {
    if (t.char_type !== enemyType || t.token_id === excludeId) continue
    const dx = (tokenPos.pos_x ?? 0) - (t.pos_x ?? 0)
    const dz = (tokenPos.pos_y ?? 0) - (t.pos_y ?? 0)
    const maxAllonge = parseInt(t.max_allonge) || 0
    if (Math.sqrt(dx * dx + dz * dz) <= 3 + maxAllonge) count++
  }
  return count
}

// ─── RÉSOLUTION RECHARGEMENT ────────────────────────────────────────────────
// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='melee'.
// Retourne true si le slot doit rester bloqué (défenseur PJ en attente), false sinon.
export async function resolveMeleeAction(io, campaignId, action, character, remainingMeleeActions = [], totalMeleeCount = 1, confirmedModifiers = null, pendingMaps) {
  try {
    const emissions = []
    const weaponInvId   = action.weapon_inv_id ?? null
    const targetTokenId = action.target_token_id
    if (!targetTokenId) return { suspend: false, emissions }

    // ── 1. Données attaquant ──────────────────────────────────────────────────
    const sheetAttaquant = await db('char_sheet').where({ character_id: character.id }).first()
    if (!sheetAttaquant) return { suspend: false, emissions }

    // Arme + formule dégâts + allonge
    let weapon = null, damageFormula = '1D4'
    if (weaponInvId) {
      weapon = await db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.id': weaponInvId })
        .select('ref_equipment.damage_h as ref_damage_h', 'char_inventory.equipment_id',
                'ref_equipment.range as ref_range')
        .first()
      if (weapon?.ref_damage_h) damageFormula = weapon.ref_damage_h
    }
    const allonge = parseInt(weapon?.ref_range) || 0

    // Validation distance Phase 2 — positions post-déplacement (PE14)
    const [myTokenPos, targetTokenPos] = await Promise.all([
      db('tokens').where({ id: action.token_id }).select('pos_x','pos_y').first(),
      db('tokens').where({ id: targetTokenId }).select('pos_x','pos_y').first(),
    ])
    const dxChk = (myTokenPos?.pos_x ?? 0) - (targetTokenPos?.pos_x ?? 0)
    const dzChk = (myTokenPos?.pos_y ?? 0) - (targetTokenPos?.pos_y ?? 0)
    const dist2dChk = Math.sqrt(dxChk * dxChk + dzChk * dzChk)
    if (dist2dChk > 3 + allonge) {
      console.warn(`[WS] resolveMeleeAction — hors portée: ${dist2dChk.toFixed(1)}m max:${3 + allonge}m token:${action.token_id}`)
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: `Corps à corps impossible — distance : ${dist2dChk.toFixed(1)}m, portée max : ${3 + allonge}m`,
      } })
      return { suspend: false, emissions }
    }

    // Skill associé à l'arme (via ref_equipment_skill_assoc) ou COMBAT_A_MAINS_NUES (mains nues)
    let skillId = 'COMBAT_A_MAINS_NUES'
    if (weapon?.equipment_id) {
      const skillAssoc = await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()
      if (skillAssoc) skillId = skillAssoc.skill_id
    }

    const [attrsAttaquant, archetypeAttaquant, charSkill, refSkill, woundsAttaquant, invAttaquant, rosterTokens, mutationEffectsAttaquant, settings] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheetAttaquant.id }),
      db('char_archetype').where({ char_sheet_id: sheetAttaquant.id }).first(),
      db('char_skills').where({ char_sheet_id: sheetAttaquant.id, skill_id: skillId }).first(),
      db('ref_skills').where({ id: skillId }).first(),
      db('character_wounds').where({ char_sheet_id: sheetAttaquant.id }),
      db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.character_id': character.id })
        .select('char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
                'ref_equipment.weight as ref_weight', 'ref_equipment.min_str as ref_min_str',
                'ref_equipment.category as ref_category'),
      // Tous les tokens actifs du roster avec leur type et leur allonge max (arme de contact équipée).
      // Utilisé pour le calcul multi-adversaires (positions post-déplacement garanties).
      db('tokens as t')
        .join('combat_roster as cr', 'cr.token_id', 't.id')
        .join('characters as c', 'c.id', 't.character_id')
        .leftJoin('char_inventory as ci',
          db.raw(`ci.character_id = c.id AND ci.slot IN ('MG', 'MD', '2M')`))
        .leftJoin('ref_equipment as re',
          db.raw(`re.id = ci.equipment_id AND re.category = 'Arme de contact'`))
        .where('cr.campaign_id', campaignId)
        .where('cr.status', 'active')
        .groupBy('t.id', 't.pos_x', 't.pos_y', 'c.type')
        .select(
          't.id as token_id',
          't.pos_x',
          't.pos_y',
          'c.type as char_type',
          db.raw(`COALESCE(MAX(CASE WHEN re.range ~ '^[0-9]+$' THEN re.range::INTEGER ELSE 0 END), 0) as max_allonge`)
        ),
      getMutationEffects(sheetAttaquant.id),
      getCampaignSettings(db, campaignId),
    ])
    const genoAttaquant = archetypeAttaquant?.genotype_id
      ? await db('ref_genotypes').where({ id: archetypeAttaquant.genotype_id }).first()
      : null

    const attackerSkillTotal = refSkill ? calcSkillTotal(attrsAttaquant, charSkill, refSkill, genoAttaquant, mutationEffectsAttaquant) : 0
    const woundPenalty = calcWoundPenalty(woundsAttaquant)
    // FOR nette = calcAttributeNA (base + pc_modifier + génotype + mutations) — corrige PI4
    // (docs/PLAN_MUTATION2.md Lot 1), calculée une fois et réutilisée (modDom/carenceArmure/encombrement).
    const for_na_attaquant = calcAttributeNA(attrsAttaquant, 'FOR', genoAttaquant, mutationEffectsAttaquant)
    const totalWeight = invAttaquant.reduce((sum, i) =>
      (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
    )
    const effectiveMalusAttaquant = woundPenalty - (settings.encumbrance_enabled
      ? calcEncumbrancePenalty(totalWeight, for_na_attaquant, settings.encumbrance_multiplier)
      : 0)
    const equippedAttaquant = invAttaquant.filter(i => i.slot != null)
    const carenceAttaquant  = calcCarenceArmure(equippedAttaquant, for_na_attaquant)
    const modDom = getModDom(for_na_attaquant)

    const rosterAttaquant = await db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first()
    if (rosterAttaquant?.state_combat_mode === 'charge' && dist2dChk <= 3) {
      emissions.push({ to: 'socket', event: WS.COMBAT_DECLARE_ERROR, data: { message: 'Charge impossible — distance ≤ 3m (élan insuffisant)' } })
      return { suspend: false, emissions }
    }
    const isRushedMod    = rosterAttaquant?.state_vitesse === 'rushed' ? -5 : 0
    const combatModeAtk  = rosterAttaquant?.state_combat_mode ?? 'normal'
    const attackModeBonus = (combatModeAtk === 'offensif' || combatModeAtk === 'charge') ? 3 : 0
    const combatModeBonus = combatModeAtk === 'charge' ? 3 : 0   // +3 dégâts Charge

    // Multi-adversaires : malus si l'attaquant est lui-même entouré d'ennemis
    const atkEnemyType = character.type === 'pj' ? 'pnj' : 'pj'
    const multiMalusAttaquant = multiAdversaryMalus(
      countAdversaires(myTokenPos, rosterTokens, action.token_id, atkEnemyType)
    )

    // CaC 4b — malus attaque multiple (LdB p.218) : −5 pour 2 attaques, −7 pour 3+
    const multiAttackMalus = totalMeleeCount === 2 ? -5 : totalMeleeCount >= 3 ? -7 : 0

    // Mods situation CaC (§6.2)
    const deuxArmesSlots = invAttaquant.filter(i => ['MD', 'MG'].includes(i.slot) && i.ref_category === 'Arme de contact')
    const deuxArmesBonus = deuxArmesSlots.length >= 2 ? 3 : 0
    const situationMods = (confirmedModifiers?.situation ?? []).filter(k => k !== 'cac_terrain_instable')
    const situationModComp = situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
    const tailleMod = TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne'] ?? 0
    let terrainInstableMod = 0, acrobatieTotal = attackerSkillTotal
    if ((confirmedModifiers?.situation ?? []).includes('cac_terrain_instable')) {
      const [acrobatieRefSkill, acrobatieCharSkill] = await Promise.all([
        db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
        db('char_skills').where({ char_sheet_id: sheetAttaquant.id, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
      ])
      acrobatieTotal = acrobatieRefSkill
        ? calcSkillTotal(attrsAttaquant, acrobatieCharSkill, acrobatieRefSkill, genoAttaquant, mutationEffectsAttaquant)
        : attackerSkillTotal
      terrainInstableMod = Math.min(0, acrobatieTotal - attackerSkillTotal)
    }

    const chancesAttaque  = attackerSkillTotal + effectiveMalusAttaquant - carenceAttaquant + isRushedMod + attackModeBonus + multiMalusAttaquant + multiAttackMalus + situationModComp + tailleMod + terrainInstableMod + deuxArmesBonus

    // Roll attaquant
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')

    // Info affichage
    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const attackerColor    = userRow?.color    ?? '#c86030'
    const attackerUsername = userRow?.username ?? character.name ?? 'Inconnu'

    const breakdownAtk = [
      { label: 'Compétence', value: attackerSkillTotal, type: 'base' },
      ...(attackModeBonus !== 0 ? [{ label: COMBAT_MODE_LABELS[combatModeAtk] ?? combatModeAtk, value: attackModeBonus, type: 'bonus' }] : []),
      ...(isRushedMod !== 0 ? [{ label: 'Précipitation', value: isRushedMod, type: 'malus' }] : []),
      ...(multiMalusAttaquant !== 0 ? [{ label: 'Multi-adversaires (attaquant)', value: multiMalusAttaquant, type: 'malus' }] : []),
      ...(multiAttackMalus !== 0 ? [{ label: 'Attaque multiple', value: multiAttackMalus, type: 'malus' }] : []),
      ...(effectiveMalusAttaquant !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalusAttaquant, type: 'malus' }] : []),
      ...(carenceAttaquant !== 0 ? [{ label: 'Carence armure', value: -carenceAttaquant, type: 'malus' }] : []),
      ...(situationModComp !== 0 ? [{ label: 'Mods situation', value: situationModComp, type: situationModComp > 0 ? 'bonus' : 'malus' }] : []),
      ...(tailleMod !== 0 ? [{ label: 'Taille cible', value: tailleMod, type: tailleMod > 0 ? 'bonus' : 'malus' }] : []),
      ...(terrainInstableMod !== 0 ? [{ label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieTotal})`, value: terrainInstableMod, type: 'malus' }] : []),
      ...(deuxArmesBonus !== 0 ? [{ label: 'Deux armes au contact', value: deuxArmesBonus, type: 'bonus' }] : []),
      { label: 'Seuil', value: chancesAttaque, type: 'total' },
    ]
    console.log(`[WS] melee attaque — roll:${rollAttaque} Seuil:${chancesAttaque} token:${action.token_id}`)
    console.log(`[DBG] melee seuil — skill:${attackerSkillTotal} eff:${effectiveMalusAttaquant} carence:${-carenceAttaquant} mode:${attackModeBonus} rush:${isRushedMod} multi:${multiMalusAttaquant} multiAtk:${multiAttackMalus} sit:${situationModComp} taille:${tailleMod} terrain:${terrainInstableMod} deuxArmes:${deuxArmesBonus} → seuil:${chancesAttaque}`)
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId: character.user_id, username: attackerUsername, color: attackerColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: rollAttaque === 1, isCriticalFail: rollAttaque === 20,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel:        'Jet pour toucher (contact)',
      mechanicalTotal:   attackerSkillTotal,
      diffLabel:         chancesAttaque - attackerSkillTotal >= 0 ? `+${chancesAttaque - attackerSkillTotal}` : `${chancesAttaque - attackerSkillTotal}`,
      chancesDeReussite: chancesAttaque,
      isSuccess:         rollAttaque <= chancesAttaque,
      mr:                chancesAttaque - rollAttaque,
      breakdown:         breakdownAtk,
    } })

    // ── 2. Cible ──────────────────────────────────────────────────────────────
    const targetToken = await db('tokens').where({ id: targetTokenId }).first()
    if (!targetToken?.character_id) {
      // Entité de décor — pas de défense ni dégâts
      emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit: false,
      } })
      return { suspend: false, emissions }
    }

    const defenderCharacter = await db('characters').where({ id: targetToken.character_id }).first()
    if (!defenderCharacter) return { suspend: false, emissions }

    const targetName = defenderCharacter.name ?? targetToken.label ?? 'Cible'

    // Multi-adversaires : malus si le défenseur est entouré d'ennemis (positions post-déplacement)
    const defEnemyType = defenderCharacter.type === 'pj' ? 'pnj' : 'pj'
    const multiMalusDefenseur = multiAdversaryMalus(
      countAdversaires(targetTokenPos, rosterTokens, targetTokenId, defEnemyType)
    )

    // ── 3. Données défenseur ──────────────────────────────────────────────────
    const sheetCible = await db('char_sheet').where({ character_id: defenderCharacter.id }).first()
    let defenderSkillTotal = 0, defenderEffectiveMalus = 0
    let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
    let char_sheet_id_cible = null

    if (sheetCible) {
      char_sheet_id_cible = sheetCible.id

      // Round 1 — parallèle : données défenseur + armes de contact équipées
      const [attrsCible, archetypeCible, woundsCible, invCible, defContactWeapons, mutationEffectsCible] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheetCible.id }),
        db('char_archetype').where({ char_sheet_id: sheetCible.id }).first(),
        db('character_wounds').where({ char_sheet_id: sheetCible.id }),
        db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': defenderCharacter.id })
          .select('char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
                  'ref_equipment.weight as ref_weight'),
        db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': defenderCharacter.id })
          .whereIn('char_inventory.slot', ['MD', 'MG', '2M'])
          .where('ref_equipment.category', 'Arme de contact')
          .select('char_inventory.slot', 'char_inventory.equipment_id'),
        getMutationEffects(sheetCible.id),
      ])

      // B1 — compétence défenseur selon arme équipée (priorité main directrice)
      const slotPriority = (sheetCible.hand_pref ?? 'R') === 'L' ? ['MG', 'MD', '2M'] : ['MD', 'MG', '2M']
      const defWeapon = slotPriority.map(s => defContactWeapons.find(w => w.slot === s)).find(w => w != null) ?? null
      let defSkillId = 'COMBAT_A_MAINS_NUES'
      if (defWeapon?.equipment_id) {
        const assoc = await db('ref_equipment_skill_assoc').where({ item_id: defWeapon.equipment_id }).first()
        if (assoc) defSkillId = assoc.skill_id
      }

      // Round 2 — parallèle : compétence défenseur + génotype
      const [charSkillDef, refSkillDef, genoCible] = await Promise.all([
        db('char_skills').where({ char_sheet_id: sheetCible.id, skill_id: defSkillId }).first(),
        db('ref_skills').where({ id: defSkillId }).first(),
        archetypeCible?.genotype_id
          ? db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first()
          : Promise.resolve(null),
      ])

      for_na_cible = calcAttributeNA(attrsCible, 'FOR', genoCible, mutationEffectsCible)
      con_na_cible = calcAttributeNA(attrsCible, 'CON', genoCible, mutationEffectsCible)
      vol_na_cible = calcAttributeNA(attrsCible, 'VOL', genoCible, mutationEffectsCible)

      if (refSkillDef) defenderSkillTotal = calcSkillTotal(attrsCible, charSkillDef, refSkillDef, genoCible, mutationEffectsCible)

      const woundPenaltyDef = calcWoundPenalty(woundsCible)
      // for_na_cible déjà calculé ci-dessus (calcAttributeNA) — corrige PI4, plus de valeur brute séparée
      const totalWeightDef = invCible.reduce((sum, i) =>
        (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
      )
      defenderEffectiveMalus = woundPenaltyDef - (settings.encumbrance_enabled
        ? calcEncumbrancePenalty(totalWeightDef, for_na_cible, settings.encumbrance_multiplier)
        : 0)
    }

    const commonPending = {
      campaignId,
      attackerTokenId: action.token_id,
      attackerCharacter: character,
      attackerUsername,
      attackerColor,
      rollAttaque,
      chancesAttaque,
      defenderSkillTotal,
      defenderEffectiveMalus,
      multiMalusAttaquant,
      multiMalusDefenseur,
      damageFormula,
      modDom,
      combatModeBonus,
      characterIdCible: defenderCharacter.id,
      cibleType: defenderCharacter.type,
      char_sheet_id_cible,
      for_na_cible,
      con_na_cible,
      vol_na_cible,
      targetName,
      userId: character.user_id,
      defenderUserId: defenderCharacter.user_id,
      // CaC 4b — attaque multiple
      remainingMeleeActions,
      totalMeleeCount,
      confirmedModifiers,
      situationDef: confirmedModifiers?.situationDef ?? [],
    }

    // ── 4. PNJ défenseur : auto-résolution ────────────────────────────────────
    if (defenderCharacter.type === 'pnj') {
      const { total: rollDefense, rolls: defRolls, seed: defSeed } = await parseDice('1d20')
      // Mode combat du défenseur — Offensif/Charge → pénalité défense
      const rosterDef = await db('combat_roster').where({ campaign_id: campaignId, token_id: targetTokenId }).first()
      const defCombatMode = rosterDef?.state_combat_mode ?? 'normal'
      let chanceDefense = defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur
      if      (defCombatMode === 'offensif') chanceDefense -= 5
      else if (defCombatMode === 'charge')   chanceDefense -= 7
      else if (defCombatMode === 'defensif') chanceDefense += 3
      else if (defCombatMode === 'retraite') chanceDefense += 5
      // Terrain instable défenseur PNJ — compétence limitative ACROBATIE_EQUILIBRE
      // attrsCible/genoCible hors scope (déclarés dans if(sheetCible)) → re-fetch conditionnel
      let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
      if ((confirmedModifiers?.situationDef ?? []).includes('cac_terrain_instable') && char_sheet_id_cible) {
        const [attrsDef, archetypeDef, acrobatieCharDef, acrobatieRefDef, mutationEffectsDef] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: char_sheet_id_cible }),
          db('char_archetype').where({ char_sheet_id: char_sheet_id_cible }).first(),
          db('char_skills').where({ char_sheet_id: char_sheet_id_cible, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
          db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
          getMutationEffects(char_sheet_id_cible),
        ])
        const genoDef = archetypeDef?.genotype_id
          ? await db('ref_genotypes').where({ id: archetypeDef.genotype_id }).first() : null
        acrobatieDefTotal = acrobatieRefDef
          ? calcSkillTotal(attrsDef, acrobatieCharDef, acrobatieRefDef, genoDef, mutationEffectsDef)
          : defenderSkillTotal
        terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
        chanceDefense += terrainInstableModDef
      }
      const mrAttaque      = chancesAttaque - rollAttaque
      const mrDefense      = chanceDefense  - rollDefense
      const attackSuccess  = rollAttaque  <= chancesAttaque
      const defenseSuccess = rollDefense  <= chanceDefense
      const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)

      const modeCombatDef = defCombatMode === 'offensif' ? -5 : defCombatMode === 'charge' ? -7 : defCombatMode === 'defensif' ? 3 : defCombatMode === 'retraite' ? 5 : 0
      const breakdownDef = [
        { label: 'Compétence', value: defenderSkillTotal, type: 'base' },
        ...(modeCombatDef !== 0 ? [{ label: COMBAT_MODE_LABELS[defCombatMode] ?? defCombatMode, value: modeCombatDef, type: modeCombatDef > 0 ? 'bonus' : 'malus' }] : []),
        ...(multiMalusDefenseur !== 0 ? [{ label: 'Multi-adversaires', value: multiMalusDefenseur, type: 'malus' }] : []),
        ...(defenderEffectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' }] : []),
        ...(terrainInstableModDef !== 0 ? [{ label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`, value: terrainInstableModDef, type: 'malus' }] : []),
        { label: 'Seuil', value: chanceDefense, type: 'total' },
      ]
      console.log(`[WS] melee défense PNJ — rollDef:${rollDefense}/${chanceDefense} → ${hit ? 'TOUCHÉ' : 'ESQUIVÉ/RATÉ'}`)

      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: null, username: defenderCharacter.name ?? 'PNJ', color: '#808080',
        formula: '1d20', rolls: defRolls, total: rollDefense,
        isCriticalSuccess: rollDefense === 1, isCriticalFail: rollDefense === 20,
        seed: defSeed, timestamp: new Date().toISOString(),
        skillLabel:        'Jet pour défendre (contact)',
        mechanicalTotal:   defenderSkillTotal,
        diffLabel:         chanceDefense - defenderSkillTotal >= 0 ? `+${chanceDefense - defenderSkillTotal}` : `${chanceDefense - defenderSkillTotal}`,
        chancesDeReussite: chanceDefense,
        isSuccess:         defenseSuccess,
        mr:                chanceDefense - rollDefense,
        breakdown:         breakdownDef,
      } })

      emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense, chanceDefense, hit,
        multiMalusAttaquant, multiMalusDefenseur,
      } })

      if (hit) {
        // Dégâts auto (même logique que PNJ dans resolveAssaultAction)
        const { total: rollLoc } = await parseDice('1d20')
        const slotCode    = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
        const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

        let etq = null
        if (char_sheet_id_cible && defenderCharacter.id) {
          const armuresCible = await db('char_inventory')
            .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where({ 'char_inventory.character_id': defenderCharacter.id })
            .whereNotNull('char_inventory.slot')
            .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
          const armuresSlot = armuresCible.filter(a =>
            a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')
          )
          etq = calcResistanceArmure(armuresSlot).etq
        }

        const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
        const degautsBruts = rawDice + (modDom ?? 0) + combatModeBonus
        const rd = calcResistanceDommages(for_na_cible, con_na_cible)
        const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)

        let severity = null, is_lethal = false
        if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
        else if (degatsNets >= 25) { severity = 'mortelle' }
        else if (degatsNets >= 20) { severity = 'critique' }
        else if (degatsNets >= 15) { severity = 'grave'    }
        else if (degatsNets >= 10) { severity = 'moyenne'  }
        else if (degatsNets >=  5) { severity = 'legere'   }

        let finalSeverity = severity, shockResult = null
        const woundResult = await woundService.applyWound(io, db, campaignId, {
          charSheetId: char_sheet_id_cible, characterId: defenderCharacter.id,
          localisation, severity,
        })
        if (woundResult) {
          finalSeverity = woundResult.finalSeverity
          shockResult = await statusService.resolveShockTest({
            finalSeverity, localisation, is_lethal,
            for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
          })
        }

        if (shockResult) {
          statusService.emitShockDiceResult(io, campaignId, shockResult, character.user_id, attackerUsername, attackerColor)
        }

        emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
          tireurId:    action.token_id, cibleId: targetTokenId,
          localisation, degautsBruts, degatsNets,
          severity: finalSeverity, is_lethal, isSuccess: true, isPnj: true,
          roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult,
        } })
        if (shockResult?.outcome && shockResult.outcome !== 'ok') {
          statusService.applyStun(io, db, campaignId, {
            targetTokenId, outcome: shockResult.outcome,
            userId: character.user_id, username: attackerUsername, color: attackerColor,
          }).catch(err => console.error('[WS] applyStun error:', err.message))
        }
      }

      // CaC 4b — attaque suivante si multi-attack
      if (remainingMeleeActions.length > 0) {
        const nextResult = await resolveMeleeAction(
          io, campaignId,
          remainingMeleeActions[0], character,
          remainingMeleeActions.slice(1), totalMeleeCount, confirmedModifiers, pendingMaps
        )
        return { ...nextResult, emissions: [...emissions, ...nextResult.emissions] }
      }
      return { suspend: false, emissions }  // slot avance immédiatement
    } else if (defenderCharacter.type === 'drone') {
      // §7.4 : sans programme esquive, le drone ne peut pas se défendre — test simple
      const hit = rollAttaque <= chancesAttaque
      emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit,
        multiMalusAttaquant,
      } })
      if (hit) {
        const droneSheet = await db('drone_sheet').where({ character_id: defenderCharacter.id }).first()
        if (droneSheet) {
          const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
          const degautsBruts = rawDice + (modDom ?? 0) + combatModeBonus
          const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
          await resolveDroneIntegrityLoss(io, campaignId, defenderCharacter.id, targetTokenId, droneSheet, degatsNetsDrone)
          emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
            tireurId: action.token_id, cibleId: targetTokenId,
            localisation: null, degautsBruts, degatsNets: degatsNetsDrone,
            severity: null, is_lethal: false, isSuccess: true, isPnj: true,
            roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
          } })
        }
      }
      if (remainingMeleeActions.length > 0) {
        const nextResult = await resolveMeleeAction(io, campaignId,
          remainingMeleeActions[0], character, remainingMeleeActions.slice(1), totalMeleeCount, confirmedModifiers, pendingMaps)
        return { ...nextResult, emissions: [...emissions, ...nextResult.emissions] }
      }
      return { suspend: false, emissions }
    }

    // ── 5. PJ défenseur : bloquer le slot, émettre le prompt ─────────────────
    await db('combat_pending').insert({ campaign_id: campaignId, token_id: targetTokenId, type: 'melee_defense', payload: commonPending })
    await setFSMSubPhase(db, campaignId, 'AWAITING_DEFENSE')

    // Cibler le socket du défenseur PJ
    const prompt = {
      attackerName:    attackerUsername,
      attackerTokenId: action.token_id,
      defenderTokenId: targetTokenId,
      rollAttaque,
      chancesAttaque,
      // Défenseur : Seuil de base (sans ajustement combat_mode, résolu au confirm) + malus encerclement
      chanceDefenseBase: defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur,
      multiMalusDefenseur,
    }
    emissions.push({ to: 'user', userId: defenderCharacter.user_id, event: WS.COMBAT_MELEE_DEFENSE_PROMPT, data: prompt, fallback: 'room' })

    return { suspend: true, emissions }  // slot bloqué jusqu'à COMBAT_MELEE_DEFENSE_CONFIRM
  } catch (err) {
    console.error('[WS] resolveMeleeAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='reload'.
// Utilise weapon_inv_id + modifiers.ammo_item_id (déclaration PJ) ou auto-sélection (PNJ).
// PNJ + pnj_unlimited_ammo : recharge sans consommer de munitions.
export async function resolveReloadAction(io, socket, campaignId, character, action) {
  const characterId = character.id
  console.log(`[DBG] resolveReload — début. characterId:${characterId} type:${character.type} campaignId:${campaignId}`)

  const settings = await getCampaignSettings(db, campaignId)
  const pnjUnlimited = settings.pnj_unlimited_ammo && character.type === 'pnj'
  const reloadMode   = settings.reload_mode
  console.log(`[DBG] resolveReload — pnj_unlimited_ammo:${settings.pnj_unlimited_ammo} pnjUnlimited:${pnjUnlimited} reloadMode:${reloadMode}`)

  const parseCount = (s) => { const m = String(s ?? '').match(/\d+/); return m ? parseInt(m[0], 10) : 0 }

  // Émet le résultat ciblé vers le socket du joueur (pas pour les PNJs)
  const emitResult = async (payload) => {
    if (!character.user_id) return
    if (socket.user?.id === character.user_id) {
      socket.emit(WS.COMBAT_RELOAD_RESULT, payload)
    } else {
      // GM a cliqué Agir pour le slot du joueur — trouver le socket du joueur
      const allSockets = await io.fetchSockets()
      const playerSock = allSockets.find(sock =>
        sock.campaignId === campaignId && sock.user?.id === character.user_id
      )
      if (playerSock) playerSock.emit(WS.COMBAT_RELOAD_RESULT, payload)
    }
  }

  // Identifier l'arme : weapon_inv_id stocké en Phase 1 (PJ) ou auto-détection MG/MD (PNJ)
  const weaponSelect = [
    'char_inventory.id',
    'char_inventory.equipment_id as weapon_equip_id',
    'char_inventory.current_ammo',
    'char_inventory.ammo_remaining',
    'ref_equipment.caliber as ref_caliber',
    'ref_equipment.ammo_count as ref_ammo_count',
  ]
  let weapons
  if (action?.weapon_inv_id) {
    const w = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.id': action.weapon_inv_id, 'char_inventory.character_id': characterId })
      .whereNotNull('ref_equipment.caliber')
      .select(weaponSelect)
      .first()
    weapons = w ? [w] : []
  } else {
    weapons = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterId })
      .whereIn('char_inventory.slot', ['MG', 'MD'])
      .whereNotNull('ref_equipment.caliber')
      .select(weaponSelect)
  }
  console.log(`[DBG] resolveReload — ${weapons.length} arme(s) à recharger`)

  for (const weapon of weapons) {
    const clipSize = parseCount(weapon.ref_ammo_count)
    console.log(`[DBG] resolveReload — arme:${weapon.id} caliber:${weapon.ref_caliber} clipSize:${clipSize}`)
    if (clipSize === 0) { console.log('[DBG] resolveReload — clipSize=0, ignorée'); continue }

    if (pnjUnlimited) {
      console.log(`[DBG] resolveReload — PNJ unlimited, rechargement direct à ${clipSize}`)
      await db('char_inventory').where({ id: weapon.id }).update({ ammo_remaining: clipSize, updated_at: db.fn.now() })
      io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: weapon.id, ammo_remaining: clipSize } })
    } else {
      // Identifier la munition : sélectionnée en Phase 1 (ammo_item_id) ou auto-sélection
      const ammoItemId = action?.modifiers?.ammo_item_id ?? null
      let ammoItem = null

      if (ammoItemId) {
        ammoItem = await db('char_inventory')
          .where({ id: ammoItemId, character_id: characterId })
          .select('id', 'equipment_id', 'quantity')
          .first()
        if (!ammoItem || ammoItem.quantity <= 0) {
          console.log(`[DBG] resolveReload — munition sélectionnée introuvable ou épuisée : ${ammoItemId}`)
          await emitResult({ success: false, characterId, caliber: weapon.ref_caliber })
          continue
        }
      } else {
        // Fallback : première munition compatible hors Coffre
        const ammoItems = await db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': characterId })
          .where(function() { this.whereNull('char_inventory.container').orWhereNot('char_inventory.container', 'Coffre') })
          .whereNot({ 'char_inventory.id': weapon.id })
          .where({ 'ref_equipment.caliber': weapon.ref_caliber })
          .select('char_inventory.id', 'char_inventory.equipment_id', 'char_inventory.quantity')
        console.log(`[DBG] resolveReload — fallback : ${ammoItems.length} munition(s) caliber:${weapon.ref_caliber}`)
        if (ammoItems.length === 0) {
          console.log(`[DBG] resolveReload — aucune munition disponible, tour consommé`)
          await emitResult({ success: false, characterId, caliber: weapon.ref_caliber })
          continue
        }
        const preferred = weapon.current_ammo ? ammoItems.find(a => a.equipment_id === weapon.current_ammo) : null
        ammoItem = preferred ?? ammoItems[0]
      }

      const currentAmmo = weapon.ammo_remaining ?? 0
      let roundsConsumed, newAmmo
      if (reloadMode === 'topup') {
        const needed   = clipSize - currentAmmo
        roundsConsumed = Math.min(needed, ammoItem.quantity)
        newAmmo        = currentAmmo + roundsConsumed
      } else {
        roundsConsumed = Math.min(clipSize, ammoItem.quantity)
        newAmmo        = roundsConsumed
      }
      console.log(`[DBG] resolveReload — mode:${reloadMode} consumed:${roundsConsumed} new_ammo:${newAmmo}`)

      await db.transaction(async (trx) => {
        await trx('char_inventory').where({ id: weapon.id }).update({
          current_ammo: ammoItem.equipment_id, ammo_remaining: newAmmo, updated_at: db.fn.now(),
        })
        if (ammoItem.quantity - roundsConsumed <= 0) {
          await trx('char_inventory').where({ id: ammoItem.id }).delete()
          io.to(campaignId).emit(WS.INVENTORY_REMOVED, { characterId, itemId: ammoItem.id })
        } else {
          const newQty = ammoItem.quantity - roundsConsumed
          await trx('char_inventory').where({ id: ammoItem.id }).update({ quantity: newQty, updated_at: db.fn.now() })
          io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: ammoItem.id, quantity: newQty } })
        }
      })
      io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: weapon.id, ammo_remaining: newAmmo } })
      await emitResult({ success: true, characterId, newAmmo, clipSize, caliber: weapon.ref_caliber })
    }
  }
  console.log(`[DBG] resolveReload — FIN. personnage ${characterId}`)
}

// ─── RÉSOLUTION ASSAUT ──────────────────────────────────────────────────────
// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='assault' + confirmedModifiers présents.
// Jets : attaque 1d20 / localisation 1d20 / dégâts selon ref_damage_h.
// Blessures : woundService.applyWound (résolution + WOUND_ADDED) + resolveShockTest caller.
// ─── resolveDroneAssaultAction — résolution attaque drone (Sprint 2c) ────────
// Appelé depuis resolveAssaultAction quand character.type === 'drone'.
// §7.3 MANUELSYSCOMBAT : D20 ≤ programme.level, modificateurs situationnels standard,
// pas de malus blessures/encombrement, pas de Test de Choc.
export async function resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  try {
    const emissions = []
    // 1. Arme drone
    const weapon = await db('drone_weapons')
      .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
      .where({ 'drone_weapons.id': action.drone_weapon_inv_id })
      .select(
        'drone_weapons.fire_mode as explicit_fire_mode',
        'ref_equipment.fire_mode as ref_fire_mode',
        'ref_equipment.range as ref_range',
        db.raw(`COALESCE(drone_weapons.damage_formula, ref_equipment.damage_h) as effective_formula`),
        db.raw(`COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name) as display_name`),
      )
      .first()

    if (!weapon?.effective_formula) {
      console.warn(`[WS] resolveDroneAssaultAction — arme sans formule. drone_weapon_inv_id:${action.drone_weapon_inv_id}`)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: null, username: character.name ?? 'Drone', color: '#30aaaa',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Armement Drone — arme sans formule de dégâts`,
        mechanicalTotal: 0, diffLabel: '', chancesDeReussite: 0, isSuccess: false,
      } })
      return { suspend: false, emissions }
    }

    // 2. Programme armement — miroir humanoïde : !ref_fire_mode → contact, sinon distance
    const isCaCWeapon = weapon.explicit_fire_mode ? weapon.explicit_fire_mode === 'cc' : !weapon.ref_fire_mode

    // ── Range check CaC drone (miroir resolveMeleeAction L.1674-1688) ──────────
    if (isCaCWeapon) {
      const allonge = parseInt(weapon?.ref_range) || 0
      const [myTokenPos, targetTokenPos] = await Promise.all([
        db('tokens').where({ id: action.token_id }).select('pos_x', 'pos_y').first(),
        db('tokens').where({ id: action.target_token_id }).select('pos_x', 'pos_y').first(),
      ])
      const dxChk = (myTokenPos?.pos_x ?? 0) - (targetTokenPos?.pos_x ?? 0)
      const dzChk = (myTokenPos?.pos_y ?? 0) - (targetTokenPos?.pos_y ?? 0)
      const dist2dChk = Math.sqrt(dxChk * dxChk + dzChk * dzChk)
      if (dist2dChk > 3 + allonge) {
        emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
          username: character.name,
          message: `Corps à corps impossible — distance : ${dist2dChk.toFixed(1)}m, portée max : ${3 + allonge}m`,
        } })
        return { suspend: false, emissions }
      }
    }

    // ── LOS check (distance uniquement) ────────────────────────────────────────
    if (!isCaCWeapon && !options.skipLos) {
      const los = await checkCombatLOS(io, db, campaignId, action, character)
      if (los.result === 'blocked') {
        return { suspend: false, emissions }
      }
      if (los.result === 'intercepted') {
        return resolveDroneAssaultAction(io, campaignId,
          { ...action, target_token_id: los.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
      options.coverageModifier = los.coverageModifier ?? 0
    }

    const category = isCaCWeapon ? 'armement_contact' : 'armement_distance'
    const programme = await db('drone_programs')
      .where({ character_id: character.id, category })
      .orderBy('level', 'desc')
      .first()

    if (!programme) {
      console.warn(`[WS] resolveDroneAssaultAction — programme ${category} introuvable pour drone ${character.id}`)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: null, username: character.name ?? 'Drone', color: '#30aaaa',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Armement Drone — programme "${category}" manquant`,
        mechanicalTotal: 0, diffLabel: 'Configurer le programme dans la fiche drone', chancesDeReussite: 0, isSuccess: false,
      } })
      return { suspend: false, emissions }
    }

    // 3. Calcul chancesDeReussite (§7.3 — même modificateurs que humanoïdes)
    // armement_contact : portée = null → PORTEE_MOD_COMP[null]??0 = 0 (contact physique, pas de modificateur portée)
    const portee = category !== 'armement_contact' ? (confirmedModifiers?.portee ?? 'courte') : null
    let totalModComp = PORTEE_MOD_COMP[portee] ?? 0
    if (confirmedModifiers?.taille) totalModComp += TAILLE_MODS[confirmedModifiers.taille] ?? 0
    const situationMods = confirmedModifiers?.situation ?? []
    totalModComp += situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
    const coverageModifier  = options.coverageModifier ?? 0
    const chancesDeReussite = programme.level + totalModComp + coverageModifier

    // 4. Jet D20
    const { total: roll, rolls: attRolls, seed: attSeed } = await parseDice('1d20')
    const isSuccess = roll <= chancesDeReussite
    const mr        = chancesDeReussite - roll

    // 5. Display data tireur
    const userRow        = character.user_id ? await db('users').where({ id: character.user_id }).select('color', 'username').first() : null
    const tireurColor    = userRow?.color    ?? '#888888'
    const tireurUsername = userRow?.username ?? character.name ?? 'Drone'
    const userId         = character.user_id ?? null
    const now            = new Date().toISOString()

    // 6. Broadcast jet programme
    const porteeModDrone = PORTEE_MOD_COMP[portee] ?? 0
    const tailleModDrone = confirmedModifiers?.taille ? (TAILLE_MODS[confirmedModifiers.taille] ?? 0) : 0
    const breakdownDrone = [
      { label: `Programme (niv. ${programme.level})`, value: programme.level, type: 'base' },
      ...(porteeModDrone !== 0 ? [{ label: PORTEE_LABELS[portee] ?? portee, value: porteeModDrone, type: porteeModDrone > 0 ? 'bonus' : 'malus' }] : []),
      ...situationMods.reduce((acc, k) => {
        const v = SITUATION_MODS[k]
        if (v !== undefined && v !== 0) acc.push({ label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' })
        return acc
      }, []),
      ...(tailleModDrone !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModDrone, type: tailleModDrone > 0 ? 'bonus' : 'malus' }] : []),
      ...(coverageModifier !== 0 ? [{ label: 'Couverture cible', value: coverageModifier, type: 'malus' }] : []),
      { label: 'Seuil', value: chancesDeReussite, type: 'total' },
    ]
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: attRolls, total: roll,
      isCriticalSuccess: false, isCriticalFail: false,
      seed: attSeed, timestamp: now,
      skillLabel: `${weapon.display_name ?? 'Armement'} — Drone`,
      mechanicalTotal: roll,
      diffLabel: `${chancesDeReussite} (Prog. niv. ${programme.level})`,
      chancesDeReussite, isSuccess,
      breakdown: breakdownDrone,
    } })

    if (!isSuccess) {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: null, degautsBruts: 0, degatsNets: 0,
        severity: null, is_lethal: false, isSuccess: false, shockResult: null,
      } })
      return { suspend: false, emissions }
    }

    // 7. Identifier la cible
    const cibleToken     = await db('tokens').where({ id: action.target_token_id }).first()
    const cibleCharacter = cibleToken?.character_id
      ? await db('characters').where({ id: cibleToken.character_id }).first()
      : null
    const formula = weapon.effective_formula.replace(/\s/g, '')

    // Helper : fetch attributs NA cible avec genotype + mutations
    const fetchCibleNA = async (charId, sheetId) => {
      const [attrsCible, archetypeCible, mutationEffectsCible] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheetId }),
        db('char_archetype').where({ char_sheet_id: sheetId }).first(),
        getMutationEffects(sheetId),
      ])
      const genoCible = archetypeCible?.genotype_id
        ? await db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first()
        : null
      return {
        for_na: calcAttributeNA(attrsCible, 'FOR', genoCible, mutationEffectsCible),
        con_na: calcAttributeNA(attrsCible, 'CON', genoCible, mutationEffectsCible),
        vol_na: calcAttributeNA(attrsCible, 'VOL', genoCible, mutationEffectsCible),
      }
    }

    // 8a. Cible = drone (§7.6 — blindage + RD intégrité, auto-resolve)
    if (cibleCharacter?.type === 'drone') {
      const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
      if (!droneSheet) return { suspend: false, emissions }
      const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
      const mrTable       = await getMrTable()
      const modDomAttaque = getModifier(mrTable, mr)
      const degautsBruts  = rawDice + modDomAttaque
      const { etqDrone, rdDrone, degatsNets } = calcDroneDegatsNets(droneSheet, degautsBruts)
      await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, action.target_token_id, droneSheet, degatsNets)
      const newIntegrite = degatsNets >= 30 ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId, username: tireurUsername, color: tireurColor,
        formula, rolls: dmgRolls, total: degautsBruts,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: dmgSeed, timestamp: now,
        skillLabel: `Dégâts — ${cibleCharacter.name} · Intégrité : ${droneSheet.integrite_actuelle} → ${newIntegrite}`,
        mechanicalTotal: rawDice,
        diffLabel: `+${modDomAttaque} MR · −${etqDrone} blindage · RD ${rdDrone}`,
        chancesDeReussite: degatsNets,
        isSuccess: degatsNets > 0,
        cardType: 'drone_damage',
      } })
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: droneSheet.localisation_ref ?? 'corps', degautsBruts, degatsNets,
        severity: null, is_lethal: false, isSuccess: true, shockResult: null,
      } })
      return { suspend: false, emissions }
    }

    // 8b. Cible = PNJ : auto-resolve
    if (!cibleCharacter || cibleCharacter.type === 'pnj') {
      const cibleSheet    = cibleCharacter ? await db('char_sheet').where({ character_id: cibleCharacter.id }).first() : null
      const { for_na, con_na, vol_na } = cibleSheet ? await fetchCibleNA(cibleCharacter.id, cibleSheet.id) : { for_na: 8, con_na: 8, vol_na: 8 }

      const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
      const mrTable       = await getMrTable()
      const modDomAttaque = getModifier(mrTable, mr)
      const degautsBruts  = rawDice + modDomAttaque
      const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
        degautsBruts,
        characterIdCible: cibleCharacter?.id ?? null,
        cibleType:        cibleCharacter?.type ?? null,
        char_sheet_id_cible: cibleSheet?.id ?? null,
        for_na_cible: for_na, con_na_cible: con_na, vol_na_cible: vol_na,
      })
      if (hitResult === null) return { suspend: false, emissions }
      const { rollLoc, locRolls, locSeed, localisation, etq, rd, degatsNets,
              is_lethal, finalSeverity, shockResult } = hitResult

      if (shockResult) {
        statusService.emitShockDiceResult(io, campaignId, shockResult, userId, tireurUsername, tireurColor)
      }

      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId, username: tireurUsername, color: tireurColor,
        formula: '1d20', rolls: locRolls, total: rollLoc,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: locSeed, timestamp: now,
        skillLabel: 'Localisation — Drone', mechanicalTotal: rollLoc, diffLabel: '',
        chancesDeReussite: LOCATION_LABELS[localisation] ?? localisation, isSuccess: true,
      } })
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId, username: tireurUsername, color: tireurColor,
        formula, rolls: dmgRolls, total: degautsBruts,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: dmgSeed, timestamp: now,
        skillLabel: `Dégâts — ${LOCATION_LABELS[localisation] ?? localisation}`,
        mechanicalTotal: rawDice, diffLabel: `Armure:${etq ?? 0} RD:${rd}`,
        chancesDeReussite: degatsNets, isSuccess: degatsNets > 0,
      } })
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation, degautsBruts, degatsNets,
        severity: finalSeverity, is_lethal, isSuccess: true, shockResult: shockResult ?? null,
      } })
      if (shockResult?.outcome && shockResult.outcome !== 'ok') {
        statusService.applyStun(io, db, campaignId, {
          targetTokenId: action.target_token_id, outcome: shockResult.outcome,
          userId, username: tireurUsername, color: tireurColor,
        }).catch(err => console.error('[WS] applyStun error:', err.message))
      }
      return { suspend: false, emissions }
    }

    // 8c. Cible = PJ → COMBAT_DAMAGE_PROMPT
    const cibleSheet    = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
    const { for_na, con_na, vol_na } = cibleSheet
      ? await fetchCibleNA(cibleCharacter.id, cibleSheet.id)
      : { for_na: 8, con_na: 8, vol_na: 8 }
    const targetName = cibleCharacter.name ?? 'Cible'

    await db('combat_pending').insert({
      campaign_id: campaignId,
      token_id: action.token_id,
      type: 'damage',
      payload: {
        campaignId,
        targetTokenId:       action.target_token_id,
        characterIdCible:    cibleCharacter.id,
        cibleType:           null,
        char_sheet_id_cible: cibleSheet?.id ?? null,
        mr, portee,
        fire_mode_bonus_dmg: 0,
        formula,
        for_na_cible:  for_na,
        con_na_cible:  con_na,
        vol_na_cible:  vol_na,
        tireurUsername, tireurColor, userId, targetName,
        type: 'assault', modDom: null, combatModeBonus: null,
        targetUserId: cibleCharacter.user_id,
      },
    })
    await setFSMSubPhase(db, campaignId, 'AWAITING_DAMAGE')

    const damagePayload = { tokenId: action.token_id, formula, targetName }
    emissions.push({ to: 'user', userId: cibleCharacter.user_id, event: WS.COMBAT_DAMAGE_PROMPT, data: damagePayload, fallback: 'socket' })
    return { suspend: false, emissions }

  } catch (err) {
    console.error('[WS] resolveDroneAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

export async function resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  try {
    const emissions = []
    // Branchement drone — avant le guard weapon_inv_id (§7 MANUELSYSCOMBAT)
    if (character.type === 'drone') {
      return resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options)
    }
    if (!action.weapon_inv_id || !action.target_token_id) return { suspend: false, emissions }

    // ── LOS check ─────────────────────────────────────────────────────────────
    if (!options.skipLos) {
      const los = await checkCombatLOS(io, db, campaignId, action, character)
      if (los.result === 'blocked') return { suspend: false, emissions }
      if (los.result === 'intercepted') {
        return resolveAssaultAction(io, campaignId,
          { ...action, target_token_id: los.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
      options.coverageModifier = los.coverageModifier ?? 0
    }

    const [weapon, rosterTireur] = await Promise.all([
      db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.id': action.weapon_inv_id })
        .select(
          'ref_equipment.damage_h as ref_damage_h',
          'char_inventory.equipment_id',
          'char_inventory.ammo_remaining',
          'ref_equipment.ammo_count as ref_ammo_count',
        )
        .first(),
      db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first(),
    ])

    if (!weapon?.ref_damage_h) {
      console.warn(`[WS] resolveAssaultAction — arme sans damage_h. weapon_inv_id:${action.weapon_inv_id}`)
      return { suspend: false, emissions }
    }

    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const tireurColor    = userRow?.color    ?? '#c86030'
    const tireurUsername = userRow?.username ?? character.name ?? 'Inconnu'

    let skillTotal = 0, effectiveMalus = 0, carenceArmure = 0

    const sheetTireur = character?.id
      ? await db('char_sheet').where({ character_id: character.id }).first()
      : null

    // Options de campagne — fetch unique réutilisé pour l'encombrement (ci-dessous) et le
    // décompte munitions PNJ (plus loin dans cette fonction, évite un second fetch identique).
    const settings = await getCampaignSettings(db, campaignId)

    if (sheetTireur) {
      const [attrsTireur, archetypeTireur, skillAssoc, woundsTireur, invTireur, mutationEffectsTireur] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheetTireur.id }),
        db('char_archetype').where({ char_sheet_id: sheetTireur.id }).first(),
        db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first(),
        db('character_wounds').where({ char_sheet_id: sheetTireur.id }),
        db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': character.id })
          .select(
            'char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
            'ref_equipment.weight as ref_weight', 'ref_equipment.min_str as ref_min_str',
          ),
        getMutationEffects(sheetTireur.id),
      ])

      const genoTireur = archetypeTireur?.genotype_id
        ? await db('ref_genotypes').where({ id: archetypeTireur.genotype_id }).first()
        : null

      if (skillAssoc) {
        const [refSkill, charSkill] = await Promise.all([
          db('ref_skills').where({ id: skillAssoc.skill_id }).first(),
          db('char_skills').where({ char_sheet_id: sheetTireur.id, skill_id: skillAssoc.skill_id }).first(),
        ])
        if (refSkill) skillTotal = calcSkillTotal(attrsTireur, charSkill, refSkill, genoTireur, mutationEffectsTireur)
      }

      const woundPenalty = calcWoundPenalty(woundsTireur)
      // FOR nette = calcAttributeNA (base + pc_modifier + génotype + mutations) — corrige PI4
      const for_na_tireur = calcAttributeNA(attrsTireur, 'FOR', genoTireur, mutationEffectsTireur)
      const totalWeight = invTireur.reduce((sum, i) => {
        if (i.container === 'Coffre' || i.ref_weight == null) return sum
        return sum + i.ref_weight * i.quantity
      }, 0)
      effectiveMalus = woundPenalty - (settings.encumbrance_enabled
        ? calcEncumbrancePenalty(totalWeight, for_na_tireur, settings.encumbrance_multiplier)
        : 0)

      const equippedTireur = invTireur.filter(i => i.slot != null)
      carenceArmure = calcCarenceArmure(equippedTireur, for_na_tireur)
    }

    const porteeModComp    = PORTEE_MOD_COMP[confirmedModifiers.portee] ?? 0
    const situationModComp = (confirmedModifiers.situation ?? [])
      .reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
    const tailleModComp    = TAILLE_MODS[confirmedModifiers.taille] ?? 0
    const isRushedMod      = rosterTireur?.state_vitesse === 'rushed' ? -5 : 0
    const fireModeComp     = action.fire_mode_bonus_comp ?? 0
    const dualWieldComp    = action.modifiers?.dual_wield_bonus_comp ?? 0
    const aimBonusComp     = action.aim_bonus_comp ?? 0
    const totalModComp     = porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp + aimBonusComp

    const coverageModifier   = options.coverageModifier ?? 0
    const chancesDeReussite  = skillTotal + totalModComp + effectiveMalus - carenceArmure + coverageModifier
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const isSuccess = rollAttaque <= chancesDeReussite
    const mr = chancesDeReussite - rollAttaque
    const breakdown = [
      { label: 'Compétence', value: skillTotal, type: 'base' },
      ...(porteeModComp !== 0 ? [{ label: PORTEE_LABELS[confirmedModifiers.portee] ?? confirmedModifiers.portee, value: porteeModComp, type: porteeModComp > 0 ? 'bonus' : 'malus' }] : []),
      ...(fireModeComp - dualWieldComp !== 0 ? [{ label: `Mode de tir (×${action.bullet_count ?? 1})`, value: fireModeComp - dualWieldComp, type: 'bonus' }] : []),
      ...(dualWieldComp !== 0 ? [{ label: 'Deux armes', value: dualWieldComp, type: 'bonus' }] : []),
      ...(aimBonusComp !== 0 ? [{ label: 'Tir visé', value: aimBonusComp, type: 'bonus' }] : []),
      ...((confirmedModifiers.situation ?? []).reduce((acc, k) => {
        const v = SITUATION_MODS[k] ?? 0
        if (v !== 0) acc.push({ label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' })
        return acc
      }, [])),
      ...(tailleModComp !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' }] : []),
      ...(isRushedMod !== 0 ? [{ label: 'Précipitation', value: isRushedMod, type: 'malus' }] : []),
      ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
      ...(carenceArmure !== 0 ? [{ label: 'Carence armure', value: -carenceArmure, type: 'malus' }] : []),
      ...(coverageModifier !== 0 ? [{ label: 'Couverture cible', value: coverageModifier, type: 'malus' }] : []),
      { label: 'Seuil', value: chancesDeReussite, type: 'total' },
    ]
    console.log(`[WS] assault — roll:${rollAttaque} Seuil:${chancesDeReussite} → ${isSuccess ? 'TOUCHE' : 'RATÉ'} MR:${mr}`)
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId:            character.user_id,
      username:          tireurUsername,
      color:             tireurColor,
      formula:           '1d20',
      rolls:             attackRolls,
      total:             rollAttaque,
      isCriticalSuccess: rollAttaque === 1,
      isCriticalFail:    rollAttaque === 20,
      seed:              attackSeed,
      timestamp:         new Date().toISOString(),
      skillLabel:        'Jet pour toucher (distance)',
      mechanicalTotal:   skillTotal,
      diffLabel:         chancesDeReussite - skillTotal >= 0 ? `+${chancesDeReussite - skillTotal}` : `${chancesDeReussite - skillTotal}`,
      chancesDeReussite,
      isSuccess,
      mr,
      breakdown,
    } })

    // ── Décompte munitions ──────────────────────────────────────────────────────
    // Balles consommées quel que soit le résultat (touché ou raté).
    // Skip si ammo_remaining = NULL (arme non initialisée = pas encore suivie).
    // Skip pour les PNJ si pnj_unlimited_ammo = true (option campagne).
    if (action.weapon_inv_id && weapon.ammo_remaining !== null && weapon.ammo_remaining !== undefined) {
      const isPnj = character.type === 'pnj'
      const skipDecrement = isPnj && settings.pnj_unlimited_ammo
      if (!skipDecrement) {
        const bulletsFired = action.bullet_count ?? 1
        const newRemaining = Math.max(0, weapon.ammo_remaining - bulletsFired)
        await db('char_inventory').where({ id: action.weapon_inv_id }).update({ ammo_remaining: newRemaining })
      }
    }

    if (isSuccess) {
      // Fetch stats de la cible (commun PJ et PNJ)
      const cibleToken = await db('tokens').where({ id: action.target_token_id }).first()
      let char_sheet_id_cible = null
      let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
      let cibleCharacter = null

      if (cibleToken?.character_id) {
        cibleCharacter = await db('characters').where({ id: cibleToken.character_id }).first()
        if (cibleCharacter) {
          const sheetCible = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
          if (sheetCible) {
            char_sheet_id_cible = sheetCible.id
            const [attrsCible, archetypeCible, mutationEffectsCible] = await Promise.all([
              db('char_attributes').where({ char_sheet_id: sheetCible.id }),
              db('char_archetype').where({ char_sheet_id: sheetCible.id }).first(),
              getMutationEffects(sheetCible.id),
            ])
            const genoCible = archetypeCible?.genotype_id
              ? await db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first()
              : null
            for_na_cible = calcAttributeNA(attrsCible, 'FOR', genoCible, mutationEffectsCible)
            con_na_cible = calcAttributeNA(attrsCible, 'CON', genoCible, mutationEffectsCible)
            vol_na_cible = calcAttributeNA(attrsCible, 'VOL', genoCible, mutationEffectsCible)
          }
        }
      }

      const targetName = cibleCharacter?.name ?? cibleToken?.label ?? 'Cible'

      if (character.type === 'pj') {
        // PJ — stocker paramètres bruts, le joueur lance les dés via CombatDamageWindow
        emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
          hit: true,
          roll: rollAttaque,
          seuil: chancesDeReussite,
          tireurTokenId: action.token_id,
          cibleTokenId: action.target_token_id,
        } })
        await db('combat_pending').insert({
          campaign_id: campaignId,
          token_id: action.token_id,
          type: 'damage',
          payload: {
            campaignId,
            targetTokenId: action.target_token_id,
            characterIdCible: cibleToken?.character_id ?? null,
            cibleType: cibleCharacter?.type ?? null,
            char_sheet_id_cible,
            mr,
            portee: confirmedModifiers.portee,
            fire_mode_bonus_dmg: action.fire_mode_bonus_dmg ?? 0,
            formula: weapon.ref_damage_h,
            for_na_cible,
            con_na_cible,
            vol_na_cible,
            tireurUsername,
            tireurColor,
            userId: character.user_id,
            targetName,
          },
        })
        await setFSMSubPhase(db, campaignId, 'AWAITING_DAMAGE')
        emissions.push({ to: 'socket', event: WS.COMBAT_DAMAGE_PROMPT, data: {
          tokenId: action.token_id,
          formula: weapon.ref_damage_h,
          targetName,
        } })
      } else {
        // PNJ — calcul complet immédiat, invisible aux joueurs
        const mrTable = await getMrTable()
        const modDomAttaque = getModifier(mrTable, mr)
        const isShortRange = ['bout_portant', 'courte'].includes(confirmedModifiers.portee)
        const modDegatsMode = isShortRange ? (action.fire_mode_bonus_dmg ?? 0) : 0
        const { total: rawDice } = await parseDice(weapon.ref_damage_h.replace(/\s/g, ''))
        const degautsBruts = rawDice + modDomAttaque + modDegatsMode

        // Branche drone — cible sans char_sheet, résistance = blindage + intégrité×2 (§7.6)
        if (cibleCharacter?.type === 'drone') {
          const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
          if (droneSheet) {
            const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
            await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, action.target_token_id, droneSheet, degatsNetsDrone)
            emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
              tireurId: action.token_id, cibleId: action.target_token_id,
              localisation: null,
              degautsBruts, degatsNets: degatsNetsDrone,
              severity: null, is_lethal: false, isSuccess: true,
              isPnj: true, roll: rollAttaque, chancesDeReussite, shockResult: null,
            } })
          }
          return { suspend: false, emissions }
        }

        const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
          degautsBruts,
          characterIdCible: cibleToken.character_id,
          cibleType:        cibleCharacter?.type ?? null,
          char_sheet_id_cible,
          for_na_cible, con_na_cible, vol_na_cible,
        })
        if (hitResult === null) return { suspend: false, emissions }
        const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult

        if (shockResult) {
          statusService.emitShockDiceResult(io, campaignId, shockResult, character.user_id, tireurUsername, tireurColor)
        }

        emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
          tireurId:    action.token_id,
          cibleId:     action.target_token_id,
          localisation,
          degautsBruts,
          degatsNets,
          severity:    finalSeverity,
          is_lethal,
          isSuccess,
          isPnj:       true,
          roll:        rollAttaque,
          chancesDeReussite,
          shockResult,
        } })
        if (shockResult?.outcome && shockResult.outcome !== 'ok') {
          statusService.applyStun(io, db, campaignId, {
            targetTokenId: action.target_token_id, outcome: shockResult.outcome,
            userId: character.user_id, username: tireurUsername, color: tireurColor,
          }).catch(err => console.error('[WS] applyStun error:', err.message))
        }
      }
    } else if (character.type === 'pj') {
      emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
        hit: false,
        roll: rollAttaque,
        seuil: chancesDeReussite,
        tireurTokenId: action.token_id,
        cibleTokenId: action.target_token_id,
      } })
    } else {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId:         action.token_id,
        cibleId:          action.target_token_id,
        isSuccess:        false,
        isPnj:            true,
        roll:             rollAttaque,
        chancesDeReussite,
        localisation:     null,
        degautsBruts:     null,
        degatsNets:       null,
        severity:         null,
        is_lethal:        false,
        shockResult:      null,
      } })
    }
    return { suspend: false, emissions }
  } catch (err) {
    console.error('[WS] resolveAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// ─── Drones — fonctions de résolution ────────────────────────────────────────

// Décrémente l'intégrité du drone après un hit, met à jour damages JSONB, broadcast.
// tokenId requis : drone_sheet n'a pas de FK token_id (PD8).
export async function resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets) {
  const damages = { ...droneSheet.damages }  // PD4 — copier avant mutation

  let severity = null
  if      (degatsNets >= 30) severity = 'detruit'
  else if (degatsNets >= 25) severity = 'mortelle'
  else if (degatsNets >= 20) severity = 'critique'
  else if (degatsNets >= 15) severity = 'grave'
  else if (degatsNets >= 10) severity = 'moyenne'
  else if (degatsNets >=  5) severity = 'legere'

  if (severity && severity !== 'detruit' && Array.isArray(damages[severity])) {
    const idx = damages[severity].indexOf(false)
    if (idx !== -1) {
      damages[severity] = [...damages[severity]]
      damages[severity][idx] = true
    }
    // B4 : si idx === -1 (toutes cases pleines pour ce niveau), décrémentation quand même — sprint futur
  }

  // LdB p.82-88 : 1 hit = 1 case = integrite -= 1. 'detruit' → integrite = 0 immédiatement.
  const newIntegrite = severity === 'detruit' ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
  const detruit = newIntegrite <= 0

  if (detruit) damages.detruit = true

  await db('drone_sheet').where({ character_id: characterId }).update({
    damages: JSON.stringify(damages),
    integrite_actuelle: newIntegrite,
  })

  if (detruit) {
    await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).delete()
  }

  io.to(campaignId).emit(WS.DRONE_INTEGRITY_UPDATED, {
    characterId,
    integrite_actuelle: newIntegrite,
    damages,
    detruit,
  })
}
