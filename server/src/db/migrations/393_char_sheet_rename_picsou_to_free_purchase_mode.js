// 393_char_sheet_rename_picsou_to_free_purchase_mode.js — renomme char_sheet.picsou_mode (migration
// 392, même session, jamais poussée ni utilisée hors de ce poste) en free_purchase_mode : nom plus
// sérieux et explicite demandé par Saar. Jamais de correction empilée sur 392 elle-même
// (.claude/rules/migrations.md) — 392 reste exacte sur ce qu'elle a réellement créé à l'époque.
export const up = async (knex) => {
  await knex.raw('ALTER TABLE char_sheet RENAME COLUMN picsou_mode TO free_purchase_mode')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE char_sheet RENAME COLUMN free_purchase_mode TO picsou_mode')
}
