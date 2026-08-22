/**
 * Migration 33 — char : ref_genotypes
 *
 * Table de référence statique des génotypes Polaris.
 * Contient les modificateurs d'attributs appliqués au calcul du Niveau Actuel (na).
 * Seed inclus : 4 génotypes V1 (HUMAIN, HYB_NAT, TEC_HYB, GEN_HYB).
 *
 * Jamais modifiée par le jeu — données issues du livre de base Polaris.
 */

export const up = async (knex) => {
  await knex.schema.createTable('ref_genotypes', (table) => {
    table.text('id').primary()                  // 'HUMAIN', 'HYB_NAT', etc.
    table.text('label').notNullable()           // nom affiché
    table.integer('mod_for').defaultTo(0)
    table.integer('mod_con').defaultTo(0)
    table.integer('mod_coo').defaultTo(0)
    table.integer('mod_ada').defaultTo(0)
    table.integer('mod_per').defaultTo(0)
    table.integer('mod_int').defaultTo(0)
    table.integer('mod_vol').defaultTo(0)
    table.integer('mod_pre').defaultTo(0)
  })

  await knex('ref_genotypes').insert([
    {
      id: 'HUMAIN',
      label: 'Humain',
      mod_for: 0, mod_con: 0, mod_coo: 0, mod_ada: 0,
      mod_per: 0, mod_int: 0, mod_vol: 0, mod_pre: 0,
    },
    {
      id: 'HYB_NAT',
      label: 'Hybride naturel',
      mod_for: 1, mod_con: 2, mod_coo: 2, mod_ada: 1,
      mod_per: 0, mod_int: -2, mod_vol: 0, mod_pre: 0,
    },
    {
      id: 'TEC_HYB',
      label: 'Techno-hybride',
      mod_for: 2, mod_con: 3, mod_coo: 0, mod_ada: -2,
      mod_per: 0, mod_int: 0, mod_vol: 3, mod_pre: -6,
    },
    {
      id: 'GEN_HYB',
      label: 'Géno-hybride',
      mod_for: 1, mod_con: 1, mod_coo: 2, mod_ada: 0,
      mod_per: 0, mod_int: 0, mod_vol: 0, mod_pre: -2,
    },
  ])
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_genotypes')
}
