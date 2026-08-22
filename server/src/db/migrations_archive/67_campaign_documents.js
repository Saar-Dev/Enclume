export const up = async (knex) => {
  await knex.schema.createTable('campaign_documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    t.string('name', 255).notNullable()
    t.text('content_html').notNullable().defaultTo('')
    t.text('gm_notes_html').notNullable().defaultTo('')
    // "all" | "none" | ["user_id", ...] — toujours fourni explicitement à l'INSERT
    t.jsonb('viewer_ids').notNullable()
    t.jsonb('editor_ids').notNullable()
    t.uuid('created_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    t.timestamps(true, true)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('campaign_documents')
}