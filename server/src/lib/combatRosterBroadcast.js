// combatRosterBroadcast.js
// docs/PLANS/PLAN_CHARACTER_STATES.md §0.4bis / Lot 2a — point unique de mise en forme du roster envoyé
// aux clients, extrait des 5 sites qui dupliquaient le même spread (socketCombatState.js ×3,
// socketCombatHelpers.js ×2). N'extrait QUE la portion réellement identique entre les 5 sites (même
// discipline que PLAN_RW_SYSCOMBAT.md §2.5.c) : chaque site garde son propre io.emit(EVENT, { roster:
// buildBroadcastRoster(rows), ...ses autres champs }) — les payloads diffèrent au-delà de `roster`
// (phase, actions...), les unifier de force serait une abstraction prématurée.
// Comportement Lot 2a : identique bit-à-bit à l'existant (retire surprise_roll, PC25). Le Lot 2b
// rendra cette fonction asynchrone pour construire state_position/state_weapon depuis
// characterStateService — pas encore fait ici.
export function buildBroadcastRoster(rows) {
  return rows.map(({ surprise_roll: _sr, ...rest }) => rest)
}
