/**
 * Migration 45 — Table polaris_mr (marges de réussite Polaris)
 *
 * MR = attributeTotal + 1d20 - difficulty_dc
 * Dmax = cases de déplacement maximum selon la MR
 *
 * Table lue une fois au démarrage via getMrTable() dans charStats.js
 * Jamais de requête SQL par jet — cache mémoire serveur.
 *
 * Source : LdB Polaris, règles de déplacement entités
 */

export const up = async (knex) => {
  await knex.schema.createTable('polaris_mr', (table) => {
    table.integer('mr_min').notNullable().primary()  // MR minimum (inclusif)
    table.integer('mr_max').nullable()               // MR maximum (null = illimité)
    table.integer('dmax').notNullable()              // cases de déplacement max
  })

  await knex('polaris_mr').insert([
    { mr_min: -999, mr_max: -1,   dmax: 0 },  // Échec
    { mr_min: 0,    mr_max: 4,    dmax: 1 },
    { mr_min: 5,    mr_max: 9,    dmax: 2 },
    { mr_min: 10,   mr_max: 14,   dmax: 3 },
    { mr_min: 15,   mr_max: 24,   dmax: 4 },
    { mr_min: 25,   mr_max: null, dmax: 5 },
  ])
}

export const down = async (knex) => {
  await knex.schema.dropTable('polaris_mr')
}
