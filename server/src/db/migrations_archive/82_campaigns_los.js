export const up = (knex) => knex.schema.table('campaigns', t => t.boolean('allow_los_cancel').defaultTo(false))
export const down = (knex) => knex.schema.table('campaigns', t => t.dropColumn('allow_los_cancel'))
