// Migration 124 — AdvantagesPanel Lot C : notes "Autres" (texte libre)
// Table dédiée, séparée de char_advantages/ref_advantages : une note narrative libre n'est pas un
// avantage mécanique (0 PC, pas de famille, pas de contrainte d'unicité). Réutiliser char_advantages
// via un ID catalogue générique bloquerait à 1 seule note active (contrainte unique advantage_id) et
// ferait porter le vrai texte par une colonne custom_label incohérente avec snapshot_data (voir
// docs/PLAN_ADVANTAGESPANEL.md Lot C). Pas de soft-delete : aucun enjeu PC/mécanique à auditer.

export const up = async (knex) => {
  await knex.schema.createTable('char_advantage_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('label').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_advantage_notes')
}
