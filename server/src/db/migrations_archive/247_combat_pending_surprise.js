// Migration 247 — combat_pending accepte le type 'surprise'
// (BUG ticket "Blocage - Joueur surpris au premier tour", 9e7aa7d5)
//
// Le jet de Réaction d'un PJ surpris était livré par un simple emit socket one-shot à COMBAT_START
// (phase ROSTER), sans jamais transiter par combat_pending — contrairement à melee_defense/damage/stun,
// qui utilisent déjà cette table pour survivre à une reconnexion. Le correctif (server/src/socket/
// socketCombatState.js) déplace l'émission du prompt à COMBAT_ANNOUNCE_START (phase ANNOUNCEMENT, seule
// phase où la FSM accepte réellement COMBAT_SURPRISE_RESULT — combatFSM.js) et le rend durable via une
// ligne combat_pending, au même patron que les 3 types existants.
//
// L'index unique partiel `combat_pending_unique_non_damage` (migration 170) couvre déjà 'surprise' sans
// modification : un PJ n'a jamais plus d'un jet de Réaction en attente à la fois, même invariant que
// melee_defense/stun.
//
// Rétrocompatible : ajoute une valeur autorisée à la contrainte CHECK, ne retire rien, aucune ligne
// existante affectée.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE combat_pending DROP CONSTRAINT chk_pending_type')
  await knex.raw(`
    ALTER TABLE combat_pending ADD CONSTRAINT chk_pending_type
      CHECK (type IN ('melee_defense', 'damage', 'stun', 'surprise'))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE combat_pending DROP CONSTRAINT chk_pending_type')
  await knex.raw(`
    ALTER TABLE combat_pending ADD CONSTRAINT chk_pending_type
      CHECK (type IN ('melee_defense', 'damage', 'stun'))
  `)
}
