import { parseDice }            from './diceParser.js'
import { isShockTestRequired }  from './woundUtils.js'
import { calcSeuils, getShockMalus } from './charStats.js'
import { WS }                   from '../../../shared/events.js'
import { getCampaignSettings }  from './campaignSettingsService.js'

// ─── emitTokenStatusUpdated ───────────────────────────────────────────────────
// Migré depuis server/src/socket/index.js — db ajouté en paramètre (était closure).
export async function emitTokenStatusUpdated(io, db, campaignId, tokenId) {
  const rows = await db('token_statuses').where({ token_id: tokenId }).select('status_code', 'expires_at_turn')
  const statuses      = rows.map(r => r.status_code)
  const statusExpiries = Object.fromEntries(rows.map(r => [r.status_code, r.expires_at_turn]))
  io.to(campaignId).emit(WS.TOKEN_STATUS_UPDATED, { tokenId, statuses, statusExpiries })
}

// ─── applyStunWithDuration ────────────────────────────────────────────────────
// Migré depuis server/src/socket/index.js — db ajouté en paramètre.
// Transaction : delete stunned+unconscious existants → insert nouveau. Exclusion mutuelle garantie.
export async function applyStunWithDuration(io, db, campaignId, tokenId, outcome, stunDuration, currentTurn) {
  const stunUntil    = currentTurn + stunDuration
  const statusCode   = outcome === 'inconscient' ? 'unconscious' : 'stunned'
  try {
    await db.transaction(async trx => {
      await trx('token_statuses')
        .where({ token_id: tokenId })
        .whereIn('status_code', ['stunned', 'unconscious'])
        .delete()
      await trx('token_statuses')
        .insert({ token_id: tokenId, status_code: statusCode, expires_at_turn: stunUntil })
    })
    await emitTokenStatusUpdated(io, db, campaignId, tokenId)
  } catch (err) {
    console.error('[statusService] applyStunWithDuration error:', err.message)
  }
  console.log(`[statusService] applyStunWithDuration — token:${tokenId} outcome:${outcome} duration:${stunDuration} until_turn:${stunUntil}`)
}

// ─── resolveShockTest ─────────────────────────────────────────────────────────
// Pure — aucune query DB, aucun broadcast WS.
// Lance le D20 Test de Choc et retourne le résultat.
// Retourne null si le test n'est pas requis pour cette blessure.
export async function resolveShockTest({ finalSeverity, localisation, is_lethal, for_na, con_na, vol_na }) {
  if (!isShockTestRequired(finalSeverity, localisation)) return null
  const seuils     = calcSeuils(for_na, con_na, vol_na)
  const shockMalus = getShockMalus(finalSeverity, localisation, is_lethal)
  const { total: roll, rolls: d20Rolls, seed: d20Seed } = await parseDice('1d20')
  let outcome
  if      (roll <= seuils.etourdissement + shockMalus) outcome = 'ok'
  else if (roll <= seuils.inconscience    + shockMalus) outcome = 'etourdi'
  else                                                   outcome = 'inconscient'
  return {
    triggered:    true,
    roll,
    rolls:        d20Rolls,
    seed:         d20Seed,
    outcome,
    shockMalus,
    seuilEtourdi: seuils.etourdissement + shockMalus,
    seuilIncons:  seuils.inconscience   + shockMalus,
  }
}

// ─── _applyAutoStun (interne) ─────────────────────────────────────────────────
// D6 auto côté serveur + applyStunWithDuration.
async function _applyAutoStun(io, db, campaignId, targetTokenId, outcome, userId, username, color, currentTurn) {
  const { total: d6Raw, rolls: d6Rolls, seed: d6Seed } = await parseDice('1d6')
  const stunDuration = outcome === 'inconscient' ? d6Raw * 10 : d6Raw
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username, color,
    formula: '1d6', rolls: d6Rolls, total: stunDuration,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: d6Seed, timestamp: new Date().toISOString(),
    skillLabel: 'Durée étourdissement',
    mechanicalTotal: d6Raw,
    diffLabel:    outcome === 'inconscient' ? ' ×10 (min→tours)' : ' tour(s)',
    chancesDeReussite: stunDuration,
    isSuccess: true,
  })
  await applyStunWithDuration(io, db, campaignId, targetTokenId, outcome, stunDuration, currentTurn)
}

// ─── applyStun ────────────────────────────────────────────────────────────────
// Effets : DB + WS. Toutes les erreurs sont absorbées.
// PJ connecté → COMBAT_STUN_PROMPT interactif (joueur lance le D6).
// PNJ + shock_auto_stun=false → COMBAT_STUN_PROMPT au socket GM.
// PNJ + shock_auto_stun=true (défaut) → D6 auto serveur.
// PJ offline → fallback auto identique à PNJ.
export async function applyStun(io, db, campaignId, {
  targetTokenId, outcome, userId, username, color,
}) {
  try {
    const tokenRow = await db('tokens')
      .where({ 'tokens.id': targetTokenId })
      .leftJoin('characters', 'characters.id', 'tokens.character_id')
      .select('characters.type as char_type', 'characters.user_id')
      .first()

    const isPJ       = tokenRow?.char_type === 'pj'
    const combatSt   = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
    const currentTurn = combatSt?.current_turn ?? 1

    if (isPJ) {
      const settings      = await getCampaignSettings(db, campaignId)
      const shockAutoStun = settings.shock_auto_stun
      const sockets       = await io.in(campaignId).fetchSockets()

      const targetSocket  = shockAutoStun
        ? sockets.find(s => s.data.userId === tokenRow.user_id)
        : sockets.find(s => s.data.role === 'gm')

      if (targetSocket) {
        await db('combat_pending').insert({
          campaign_id: campaignId,
          token_id:    targetTokenId,
          type:        'stun',
          payload:     { campaignId, targetTokenId, outcome, targetUserId: shockAutoStun ? tokenRow.user_id : null, userId, username, color, currentTurn, isGmPrompt: !shockAutoStun },
        })
        targetSocket.emit(WS.COMBAT_STUN_PROMPT, { tokenId: targetTokenId, outcome })
        return
      }
      // PJ offline / pas de GM → fallback auto
    } else {
      // PNJ : brancher sur shock_auto_stun
      const settings      = await getCampaignSettings(db, campaignId)
      const shockAutoStun = settings.shock_auto_stun
      if (!shockAutoStun) {
        // shock_auto_stun = false : GM lance le D6 pour ses PNJs
        const sockets   = await io.in(campaignId).fetchSockets()
        const gmSocket  = sockets.find(s => s.data.role === 'gm')
        if (gmSocket) {
          await db('combat_pending').insert({
            campaign_id: campaignId,
            token_id:    targetTokenId,
            type:        'stun',
            payload:     { campaignId, targetTokenId, outcome, targetUserId: null, userId, username, color, currentTurn, isGmPrompt: true },
          })
          gmSocket.emit(WS.COMBAT_STUN_PROMPT, { tokenId: targetTokenId, outcome })
          return
        }
        // Pas de GM connecté → fallback auto
      }
    }

    // Auto D6 (PNJ + shockAutoStun=true, ou fallback offline/no-GM)
    await _applyAutoStun(io, db, campaignId, targetTokenId, outcome, userId, username, color, currentTurn)
  } catch (err) {
    console.error('[statusService] applyStun error:', err.message)
  }
}

// ─── emitShockDiceResult ──────────────────────────────────────────────────────
// Synchrone — emit DICE_RESULT D20 Test de Choc vers tous les clients de la campagne.
// Appelé après chaque resolveShockTest non-null, avant COMBAT_ATTACK_RESULT.
export function emitShockDiceResult(io, campaignId, shockResult, userId, username, color) {
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username, color,
    formula:           '1d20',
    rolls:             shockResult.rolls,
    total:             shockResult.roll,
    isCriticalSuccess: false,
    isCriticalFail:    false,
    seed:              shockResult.seed,
    timestamp:         new Date().toISOString(),
    skillLabel:        'Test de Choc',
    mechanicalTotal:   shockResult.seuilEtourdi,
    diffLabel:         '',
    chancesDeReussite: shockResult.seuilIncons,
    isSuccess:         shockResult.outcome === 'ok',
    cardType:          'shock_test',
  })
}
