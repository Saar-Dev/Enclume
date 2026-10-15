// 391_decal_assets_constraints.js — contraintes de decal_assets (390)
//
// category bornée aux deux valeurs prévues par le Lot 0 (PLAN_DECALS.md) — étendre cette liste est
// une migration future, pas une valeur libre.
// unique(source_pack, label) rend l'import idempotent par clé naturelle, jamais l'id UUID
// (.claude/rules/core.md, SEED-ID-DETERM) : rejouer le script d'import ne duplique rien.

export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE decal_assets
      ADD CONSTRAINT chk_decal_assets_category
      CHECK (category IN ('signage', 'military'))
  `)
  await knex.raw(`
    ALTER TABLE decal_assets
      ADD CONSTRAINT decal_assets_source_pack_label_unique
      UNIQUE (source_pack, label)
  `)
  await knex.raw(`
    CREATE INDEX decal_assets_category_idx ON decal_assets (category) WHERE deprecated = false
  `)
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS decal_assets_category_idx')
  await knex.raw('ALTER TABLE decal_assets DROP CONSTRAINT IF EXISTS decal_assets_source_pack_label_unique')
  await knex.raw('ALTER TABLE decal_assets DROP CONSTRAINT IF EXISTS chk_decal_assets_category')
}
