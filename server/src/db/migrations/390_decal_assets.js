// 390_decal_assets.js — catalogue des décorations murales (docs/PLANS/PLAN_DECALS.md Lot 0)
//
// Fiche distincte de surface_textures (faces 6-faces d'un cube, pensée pour un matériau de mur/sol
// répété à l'infini) : un décal est une image UNIQUE détourée (alpha), posée à une taille et une
// position précises — ratio dérivé de width_px/height_px, jamais stocké séparément (une seule
// autorité pour la même donnée).
//
// Contenu initial : pack acheté par Saar, trié et nettoyé (voir docs/PLANS/PLAN_DECALS.md
// §Catalogue réel), importé par server/src/scripts/import_decal_assets_20261014_initial.js — un
// script, jamais un seed Knex (le seed ne doit pas faire d'appel réseau vers MinIO, hors de son
// rôle, corrigé après relecture critique du 2026-10-14).

export const up = async (knex) => {
  await knex.schema.createTable('decal_assets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.text('category').notNullable()
    t.text('label').notNullable()
    t.text('image_path').notNullable()
    t.integer('width_px').notNullable()
    t.integer('height_px').notNullable()
    t.text('source_pack').notNullable()
    t.boolean('deprecated').notNullable().defaultTo(false)
    t.integer('sort_order').notNullable().defaultTo(0)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

export const down = async (knex) => {
  await knex.raw('DROP TABLE IF EXISTS decal_assets CASCADE')
}
