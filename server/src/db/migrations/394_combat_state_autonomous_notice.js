// 394_combat_state_autonomous_notice.js — COMBAT-DRONES-ONLY-LOOP : mémorise qu'un combat a déjà
// reçu l'avertissement MJ "ce combat ne contient plus que des drones autonomes" (une seule fois par
// combat — la ligne combat_state est recréée à chaque COMBAT_START, supprimée à COMBAT_END, donc
// aucun reset explicite n'est nécessaire). Additive pure, même patron que la migration 392.
export const up = async (knex) => {
  await knex.raw('ALTER TABLE combat_state ADD COLUMN IF NOT EXISTS autonomous_notice_sent boolean NOT NULL DEFAULT false')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE combat_state DROP COLUMN IF EXISTS autonomous_notice_sent')
}
