import { WS } from '../../../shared/events.js'
import { getCampaignSettings } from './campaignSettingsService.js'
import { evaluateBattlemapVisibility } from '../services/worldVisibilityService.js'

async function loadVisibility(db, sourceToken, targetToken) {
  if (sourceToken.battlemap_id !== targetToken.battlemap_id) return { status: 'cross-battlemap' }
  const battlemap = await db('battlemaps').where({ id: sourceToken.battlemap_id }).first()
  if (!battlemap) return { status: 'battlemap-not-found' }
  return evaluateBattlemapVisibility({
    battlemap,
    sourceToken,
    targetToken,
    database: db,
  })
}

/**
 * Vérifie LOS, couverture et intercepteurs pour une action de tir. Toute décision spatiale provient
 * du WorldSnapshot ; ce service conserve seulement les effets métier du combat (message et munition).
 */
export async function checkCombatLOS(io, db, campaignId, action, character) {
  const [srcToken, tgtToken, settings] = await Promise.all([
    db('tokens').where({ id: action.token_id }).first(),
    db('tokens').where({ id: action.target_token_id }).first(),
    getCampaignSettings(db, campaignId),
  ])
  if (!srcToken || !tgtToken) return { result: 'clear' }
  if (srcToken.battlemap_id !== tgtToken.battlemap_id) return { result: 'clear' }

  const visibility = await loadVisibility(db, srcToken, tgtToken)
  if (visibility.status === 'legacy-position' || visibility.status === 'battlemap-not-found') {
    io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
      username: character.name,
      message: 'Position incompatible avec le moteur de monde',
    })
    await spendAmmo(db, action, character, settings)
    return { result: 'blocked' }
  }
  if (visibility.status === 'blocked') {
    io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
      username: character.name,
      message: 'Ligne de vue bloquée',
    })
    await spendAmmo(db, action, character, settings)
    return { result: 'blocked' }
  }

  if (visibility.interceptors.length > 0) {
    const interceptorId = visibility.interceptors[0].actorId
    const first = await db('tokens').where({ id: interceptorId }).select('id', 'label').first()
    if (first) {
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: character.user_id,
        username: character.name ?? 'Inconnu',
        color: '#c86030',
        formula: '—',
        rolls: [],
        total: 0,
        isCriticalSuccess: false,
        isCriticalFail: false,
        seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Cible interposée — tir redirigé vers ${first.label ?? 'token inconnu'}`,
        mechanicalTotal: 0,
        diffLabel: '',
        chancesDeReussite: 0,
        isSuccess: false,
        mr: 0,
        breakdown: [],
      })
      return { result: 'intercepted', newTargetTokenId: first.id }
    }
  }

  return { result: 'clear', coverageModifier: visibility.coverage.modifier }
}

/** Vérification pure de précheck, sans effet de combat. */
export async function checkLOSForPrecheck(db, tokenId, targetTokenId) {
  const [srcToken, tgtToken] = await Promise.all([
    db('tokens').where({ id: tokenId }).first(),
    db('tokens').where({ id: targetTokenId }).first(),
  ])
  if (!srcToken || !tgtToken) return true
  if (srcToken.battlemap_id !== tgtToken.battlemap_id) return true
  const visibility = await loadVisibility(db, srcToken, tgtToken)
  return visibility.status === 'clear'
}

async function spendAmmo(db, action, character, settings) {
  if (!action.weapon_inv_id) return
  if (character.type === 'pnj' && settings.pnj_unlimited_ammo) return
  const weapon = await db('char_inventory')
    .where({ id: action.weapon_inv_id })
    .select('ammo_remaining')
    .first()
  if (weapon?.ammo_remaining == null) return
  await db('char_inventory')
    .where({ id: action.weapon_inv_id })
    .update({ ammo_remaining: Math.max(0, weapon.ammo_remaining - (action.bullet_count ?? 1)) })
}
