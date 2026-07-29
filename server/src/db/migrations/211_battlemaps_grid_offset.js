// Migration 211 — docs/PLAN_BATTLEMAP2D.md §8 (Lot 3). Décalage de la grille en pixels, pour
// corriger un désalignement de l'image uploadée avec la grille (quasi jamais pile au premier essai,
// constat Roll20). Purement visuel — ne touche pas surface_data/la géométrie du moteur monde.

export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.integer('grid_offset_x').notNullable().defaultTo(0)
    table.integer('grid_offset_y').notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('grid_offset_x')
    table.dropColumn('grid_offset_y')
  })
}
