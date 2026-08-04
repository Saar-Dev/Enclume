// characterStateShadowCheck.js
// Dispositif TEMPORAIRE — Lot 1 de docs/PLANS/PLAN_CHARACTER_STATES.md, méthode Scientist (même
// dispositif que docs/PLANS/PLAN_RW_SYSCOMBAT.md §2.3) : compare la valeur combat_roster (autorité
// actuelle, seule utilisée en aval pendant cette phase) à character_states (nouvelle autorité en
// construction) juste après chaque double-écriture. Écart loggé, jamais bloquant.
// Supprimé au commit qui clôture le Lot 2b — jamais laissé en double-écriture permanente.

import { getCharacterStates } from './characterStateService.js'

export async function shadowCheckCharacterState(trx, tokenId, expected) {
  const actual = await getCharacterStates(trx, tokenId)
  for (const axis of ['position', 'weapon']) {
    if (actual[axis] !== expected[axis]) {
      console.warn(
        `[DBG-DECOUPLAGE] character_states token=${tokenId} axis=${axis} ` +
        `combat_roster=${expected[axis]} character_states=${actual[axis]}`
      )
    }
  }
}
