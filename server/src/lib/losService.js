import { WS } from '../../../shared/events.js'
import { checkLOS, findInterceptingTokens, checkCoverage } from '../../../shared/losUtils.js'

/**
 * Vérifie LOS et intercepteurs pour une action de tir distance.
 * Gère les notifications chat et décompte munition si nécessaire.
 *
 * @param {Object} io          — Socket.io server instance (broadcasts)
 * @param {Object} db          — Knex instance
 * @param {string} campaignId  — UUID
 * @param {Object} action      — { token_id, target_token_id, weapon_inv_id, bullet_count }
 * @param {Object} character   — { user_id, name, type } — garantis par COMBAT_ACTION_CONFIRM L.879
 * @returns {Promise<{result: 'clear'|'blocked'|'intercepted', newTargetTokenId?: string}>}
 */
export async function checkCombatLOS(io, db, campaignId, action, character) {
  const [srcToken, tgtToken, campaign] = await Promise.all([
    db('tokens').where({ id: action.token_id }).select('pos_x', 'pos_y', 'pos_z', 'battlemap_id').first(),
    db('tokens').where({ id: action.target_token_id }).select('id', 'pos_x', 'pos_y', 'pos_z', 'label', 'battlemap_id').first(),
    db('campaigns').where({ id: campaignId }).select('allow_los_cancel', 'pnj_unlimited_ammo').first(),
  ])

  if (!srcToken || !tgtToken) {
    console.log(`[DBG-LOS] early-clear — srcToken:${!!srcToken} tgtToken:${!!tgtToken} src_id:${action.token_id} tgt_id:${action.target_token_id}`)
    return { result: 'clear' }
  }
  console.log(`[DBG-LOS] src(${action.token_id}) bmap:${srcToken.battlemap_id} pos:(${srcToken.pos_x},${srcToken.pos_y},${srcToken.pos_z})`)
  console.log(`[DBG-LOS] tgt(${action.target_token_id}) bmap:${tgtToken.battlemap_id} pos:(${tgtToken.pos_x},${tgtToken.pos_y},${tgtToken.pos_z})`)
  // P-LOS7 — cross-battlemap : pas de LOS check entre deux cartes différentes
  if (srcToken.battlemap_id !== tgtToken.battlemap_id) {
    console.log(`[DBG-LOS] cross-battlemap → clear`)
    return { result: 'clear' }
  }

  const bmap = await db('battlemaps').where({ id: srcToken.battlemap_id }).select('voxel_data').first()
  const voxels = bmap?.voxel_data ?? {}
  console.log(`[DBG-LOS] voxelCount:${Object.keys(voxels).length}`)

  // PE14 : pos_y DB = Z Three.js (profondeur), pos_z DB = Y Three.js (altitude)
  const _fx = srcToken.pos_x + 0.5, _fy = srcToken.pos_z + 2.5, _fz = srcToken.pos_y + 0.5
  const _tx = tgtToken.pos_x + 0.5, _ty = tgtToken.pos_z + 2.5, _tz = tgtToken.pos_y + 0.5
  const _d  = Math.sqrt((_tx - _fx) ** 2 + (_ty - _fy) ** 2 + (_tz - _fz) ** 2)
  console.log(`[DBG-LOS] eye-src:(${_fx},${_fy},${_fz}) eye-tgt:(${_tx},${_ty},${_tz}) dist:${_d.toFixed(2)}m`)

  const { clear } = checkLOS(voxels, srcToken, tgtToken)
  console.log(`[DBG-LOS] checkLOS → clear:${clear}`)
  if (!clear) {
    console.log(`[DBG-LOS] → BLOCKED — COMBAT_DECLARE_ERROR → campagne ${campaignId}`)
    // Tir en aveugle (optionnel, non implémenté) — voir BUGIDENTIFIE.md
    io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: 'Ligne de vue bloquée' })
    await _spendAmmo(db, action, character, campaign)
    return { result: 'blocked' }
  }

  // tokens — WHERE battlemap_id uniquement (tokens n'a pas de campaign_id)
  const allTokens = await db('tokens')
    .where({ battlemap_id: srcToken.battlemap_id })
    .select('id', 'pos_x', 'pos_y', 'pos_z', 'label')

  const interceptors = findInterceptingTokens(voxels, allTokens, srcToken, tgtToken)
  if (interceptors.length > 0) {
    const first = interceptors[0].token
    console.log(`[DBG-LOS] → INTERCEPTED by ${first.label ?? first.id} → DICE_RESULT émis`)
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId: character.user_id, username: character.name ?? 'Inconnu', color: '#c86030',
      formula: '—', rolls: [], total: 0,
      isCriticalSuccess: false, isCriticalFail: false, seed: null,
      timestamp: new Date().toISOString(),
      skillLabel: `Cible interposée — tir redirigé vers ${first.label ?? 'token inconnu'}`,
      mechanicalTotal: 0, diffLabel: '', chancesDeReussite: 0,
      isSuccess: false, mr: 0, breakdown: [],
    })
    return { result: 'intercepted', newTargetTokenId: first.id }
  }

  const { blocked, total, modifier: coverageModifier } = checkCoverage(voxels, srcToken, tgtToken)
  console.log(`[DBG-LOS] coverage → ${blocked}/${total} bloqué → modifier:${coverageModifier}`)
  return { result: 'clear', coverageModifier }
}

/**
 * Vérification LOS pure sans side effects — utilisée par COMBAT_ACTION_PRECHECK.
 * Retourne true si la ligne de vue est dégagée (ou cross-battlemap → clear par convention).
 */
export async function checkLOSForPrecheck(db, tokenId, targetTokenId) {
  const [srcToken, tgtToken] = await Promise.all([
    db('tokens').where({ id: tokenId }).select('pos_x', 'pos_y', 'pos_z', 'battlemap_id').first(),
    db('tokens').where({ id: targetTokenId }).select('pos_x', 'pos_y', 'pos_z', 'battlemap_id').first(),
  ])
  if (!srcToken || !tgtToken) return true
  if (srcToken.battlemap_id !== tgtToken.battlemap_id) return true
  const bmap = await db('battlemaps').where({ id: srcToken.battlemap_id }).select('voxel_data').first()
  const voxels = bmap?.voxel_data ?? {}
  const { clear } = checkLOS(voxels, srcToken, tgtToken)
  return clear
}

// Miroir exact de la logique resolveAssaultAction (pnj_unlimited_ammo inclus)
async function _spendAmmo(db, action, character, campaign) {
  if (!action.weapon_inv_id) return
  const isPnj = character.type === 'pnj'
  if (isPnj && (campaign?.pnj_unlimited_ammo ?? true)) return
  const wAmmo = await db('char_inventory').where({ id: action.weapon_inv_id }).select('ammo_remaining').first()
  if (wAmmo?.ammo_remaining == null) return
  await db('char_inventory').where({ id: action.weapon_inv_id })
    .update({ ammo_remaining: Math.max(0, wAmmo.ammo_remaining - (action.bullet_count ?? 1)) })
}
