/**
 * Migration 44 — Colonne `r` sur tokens
 *
 * r = orientation du token en 8 incréments de 45°
 * Valeurs : 0-7 — rotation.y = r * Math.PI / 4 (PE21)
 * V1 : UI propose 0/2/4/6 (90°) — V2 (9F-C) : tous les incréments
 * Migration unique — anticipe 9F-C (diagonal + rotation libre)
 */

export const up = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.integer('r').notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('r')
  })
}
