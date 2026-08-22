// Migration 137 — char_inventory_mods (docs/PLAN_MODING.md Phase A, Étape 1)
//
// Rangement pur : un module d'arme (accessoire) installé sur une arme est retiré de
// l'inventaire (char_inventory) et enregistré ici. Aucun effet mécanique (Phase B, hors scope).
//
// UNIQUE(weapon_inv_id, equipment_id) — ajoutée suite à l'analyse critique du 2026-07-12 : le
// check anti-doublon applicatif seul (P6) laisse une fenêtre de course entre deux requêtes
// concurrentes (ex. mod en stack ×2+, les deux passent le SELECT avant que la première ne
// commite). Pas besoin d'index partiel comme uq_char_mut_no_sub (migration 109) : un nouvel
// install exige toujours un equipment_id non nul, seules les lignes historiques dont le
// catalogue a été supprimé après coup portent equipment_id = NULL, et Postgres ne fait jamais
// collisionner deux NULL sur une contrainte UNIQUE.
export const up = async (knex) => {
  await knex.schema.createTable('char_inventory_mods', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('weapon_inv_id').notNullable()
      .references('id').inTable('char_inventory').onDelete('CASCADE')
    table.uuid('equipment_id').nullable()
      .references('id').inTable('ref_equipment').onDelete('SET NULL')
    table.text('mod_name').notNullable()
    table.timestamp('installed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.unique(['weapon_inv_id', 'equipment_id'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_inventory_mods')
}
