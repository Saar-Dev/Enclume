// 242_char_gauges.js
// PLAN_WIZARD_MATERIEL_GAUGES.md §1 — ressource de personnage indépendante du cycle de
// réconciliation Step1-5 (jamais recalculée/écrasée par creationService.js, cf. §0bis point 1).
// Patron de forme réutilisé de char_attributes/char_skills (migration 36) : lignes normalisées
// (char_sheet_id, category_key, value), pas de jsonb.

export const up = async (knex) => {
  await knex.schema.createTable('char_gauges', (table) => {
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('category_key').notNullable()
    table.integer('value').notNullable().defaultTo(0)
    table.primary(['char_sheet_id', 'category_key'])
  })

  // Décision Saar 2026-08-12 (PLAN_WIZARD_MATERIEL_GAUGES.md §10) : une jauge ne peut jamais devenir
  // négative. Backstop DB en plus du clamp serveur (§3) — même patron que chk_inventory_quantity
  // (migration 50_char_inventory.js).
  await knex.raw(`
    ALTER TABLE char_gauges
    ADD CONSTRAINT chk_gauges_value_non_negative
    CHECK (value >= 0)
  `)

  // char_inventory — statut de validation MJ (PLAN_WIZARD_MATERIEL_GAUGES.md §3/§4)
  await knex.schema.alterTable('char_inventory', (table) => {
    table.boolean('validated_by_gm').notNullable().defaultTo(false)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_inventory', (table) => {
    table.dropColumn('validated_by_gm')
  })
  await knex.schema.dropTableIfExists('char_gauges')
}
