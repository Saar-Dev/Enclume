export const up = (knex) => {
  return knex.schema.alterTable('campaigns', (table) => {
    table.text('cover_image_url')
    table.jsonb('critical_success')
    table.jsonb('critical_fail')
  })
}

export const down = (knex) => {
  return knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('cover_image_url')
    table.dropColumn('critical_success')
    table.dropColumn('critical_fail')
  })
}
