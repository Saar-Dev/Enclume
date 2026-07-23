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

// Message narratif « cible interposée » + résultat de redirection (docs/PLAN_COMBAT_TIMELINE.md §6
// point 3, analyse à charge) — un seul patron pour les deux cas où visibility.interceptors est
// consulté (ligne dégagée ET ligne bloquée : le moteur monde ne distingue pas « mur bloquant » de
// « cible hors de portée » sous le même signal status:'blocked', un mur qui bloque réellement tout
// ne laisse remonter aucun intercepteur non plus — sans conséquence pratique).
async function redirectToInterceptor(io, db, campaignId, character, interceptors) {
  const interceptorId = interceptors[0]?.actorId
  if (!interceptorId) return null
  const first = await db('tokens').where({ id: interceptorId }).select('id', 'label').first()
  if (!first) return null
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

/**
 * Vérifie LOS, couverture et intercepteurs pour une action de tir. Toute décision spatiale provient
 * du WorldSnapshot ; ce service conserve seulement les effets métier du combat (message et munition).
 */
export async function checkCombatLOS(io, db, campaignId, action, character) {
  console.log(`[DBG] checkCombatLOS — début token:${action.token_id} target:${action.target_token_id}`)
  const [srcToken, tgtToken, settings] = await Promise.all([
    db('tokens').where({ id: action.token_id }).first(),
    db('tokens').where({ id: action.target_token_id }).first(),
    getCampaignSettings(db, campaignId),
  ])
  if (!srcToken || !tgtToken) return { result: 'clear' }
  if (srcToken.battlemap_id !== tgtToken.battlemap_id) return { result: 'clear' }

  console.log(`[DBG] checkCombatLOS — avant loadVisibility`)
  const visibility = await loadVisibility(db, srcToken, tgtToken)
  console.log(`[DBG] checkCombatLOS — après loadVisibility, status:${visibility.status}`)
  if (visibility.status === 'legacy-position' || visibility.status === 'battlemap-not-found') {
    io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
      username: character.name,
      message: 'Position incompatible avec le moteur de monde',
    })
    await spendAmmo(db, action, character, settings)
    return { result: 'blocked' }
  }
  if (visibility.status === 'blocked') {
    // §6 point 3 du plan Timeline — la cible devenue inatteignable (déplacée, cachée) ne doit pas
    // faire capoter le tir si quelqu'un se trouve sur le vecteur : munitions consommées, jet complet
    // contre l'intercepteur (même patron que l'interposition sur ligne dégagée ci-dessous), jamais un
    // abandon muet du tir. worldVisibilityService calcule déjà les intercepteurs dans tous les cas.
    const redirected = await redirectToInterceptor(io, db, campaignId, character, visibility.interceptors ?? [])
    if (redirected) {
      await spendAmmo(db, action, character, settings)
      return redirected
    }
    io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, {
      username: character.name,
      message: 'Ligne de vue bloquée',
    })
    await spendAmmo(db, action, character, settings)
    return { result: 'blocked' }
  }

  const redirected = await redirectToInterceptor(io, db, campaignId, character, visibility.interceptors ?? [])
  if (redirected) return redirected

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
