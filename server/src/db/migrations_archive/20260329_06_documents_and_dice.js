export const up = async (knex) => {
  await knex.schema.createTable('documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('uploaded_by').notNullable().references('id').inTable('users')
    table.text('name').notNullable()
    table.text('file_url').notNullable()
    table.text('file_type')
    table.text('visibility').defaultTo('gm_only')
    table.timestamps(true, true)
  })

  await knex.schema.createTable('dice_rolls', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users')
    table.text('formula').notNullable()
    table.jsonb('results').notNullable()
    table.integer('total').notNullable()
    table.timestamps(true, true)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('dice_rolls')
  await knex.schema.dropTable('documents')
}