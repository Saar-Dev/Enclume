// 392_char_sheet_picsou_mode.js — bascule MJ only « mode Picsou » (argent illimité/achat gratuit)
// par personnage joueur, en session (COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE n'est pas le ticket
// concerné ; voir le ticket "Playground : le joueur peut créer un item catalogue sans coût").
// Additive pure, même patron que la migration 346 (`is_electronic`) : ADD COLUMN NOT NULL DEFAULT
// false, aucun backfill (défaut correct pour toute ligne existante).
export const up = async (knex) => {
  await knex.raw('ALTER TABLE char_sheet ADD COLUMN IF NOT EXISTS picsou_mode boolean NOT NULL DEFAULT false')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE char_sheet DROP COLUMN IF EXISTS picsou_mode')
}
