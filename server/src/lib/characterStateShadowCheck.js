// characterStateShadowCheck.js
// Dispositif Lot 1 de docs/PLANS/PLAN_CHARACTER_STATES.md, méthode Scientist (même dispositif que
// docs/PLANS/PLAN_RW_SYSCOMBAT.md §2.3) : compare la valeur combat_roster à character_states juste
// après chaque double-écriture. Écart loggé, jamais bloquant.
// Statut révisé au Lot 2b (§3.1) : la suppression des colonnes combat_roster.state_position/
// state_weapon est différée (Codex hors projet, clôture alignée sur PLAN_RW_TOKEN.md plus tard) —
// combat_roster reste écrit et reste l'autorité lue par socketCombatAnnouncement.js (`entry`, coût
// d'Initiative + validation Tir Visé). Ce fichier reste donc actif au-delà du Lot 1 comme garde-fou de
// cohérence entre les deux sources, pas seulement comme filet avant cutover — à retirer seulement
// quand combat_roster.state_position/state_weapon seront effectivement supprimées.

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
