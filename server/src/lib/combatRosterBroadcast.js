// combatRosterBroadcast.js
// docs/PLANS/PLAN_CHARACTER_STATES.md §0.4bis / Lot 2a+2b — point unique de mise en forme du roster
// envoyé aux clients, extrait des 5 sites qui dupliquaient le même spread (socketCombatState.js ×3,
// socketCombatHelpers.js ×2). N'extrait QUE la portion réellement identique entre les 5 sites (même
// discipline que PLAN_RW_SYSCOMBAT.md §2.5.c) : chaque site garde son propre io.emit(EVENT, { roster:
// await buildBroadcastRoster(db, rows), ...ses autres champs }) — les payloads diffèrent au-delà de
// `roster` (phase, actions...), les unifier de force serait une abstraction prématurée.
//
// Lot 2b — state_position/state_weapon proviennent maintenant de characterStateService, pas des
// colonnes combat_roster. Portée volontairement limitée à CE payload (ce que voient les clients) :
// combat_roster.state_position/state_weapon restent lus directement ailleurs pour une règle de jeu
// serveur distincte (validation Tir Visé + coût d'Initiative, socketCombatAnnouncement.js:139/391-404,
// via `entry`) — non concernés par ce Lot, toujours alimentés par le Lot 1 (double-écriture active,
// non retirée). Retrait des colonnes explicitement différé (docs/PLANS/PLAN_CHARACTER_STATES.md §3.1).
import { getCharacterStatesForTokens } from './characterStateService.js'

export async function buildBroadcastRoster(db, rows) {
  const statesByToken = await getCharacterStatesForTokens(db, rows.map(r => r.token_id))
  return rows.map(({ surprise_roll: _sr, ...rest }) => ({
    ...rest,
    state_position: statesByToken.get(rest.token_id).position,
    state_weapon:   statesByToken.get(rest.token_id).weapon,
  }))
}
