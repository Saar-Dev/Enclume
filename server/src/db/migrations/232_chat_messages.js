// 232_chat_messages.js — docs/PLANS/PLAN_CHAT.md Phase 1. Table de persistance du chat, non encore
// branchée dans l'existant (handler CHAT_MESSAGE de socketDice.js continue de fonctionner tel quel).
// recipient_user_id : ajouté à la revue de complétude (PLAN_CHAT.md §16) — NULL sauf channel_id =
// 'whisper', où il porte le destinataire du message privé (filtrage §10, chatRepository.getMessages).
export const up = async (knex) => {
  await knex.schema.createTable('chat_messages', (table) => {
    table.bigIncrements('id').primary()
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.text('channel_id').notNullable().defaultTo('general')
    table.uuid('sender_user_id').references('id').inTable('users').onDelete('SET NULL')
    table.uuid('character_id').references('id').inTable('characters').onDelete('SET NULL')
    table.uuid('recipient_user_id').references('id').inTable('users').onDelete('SET NULL')
    table.text('type').notNullable()
    table.jsonb('payload').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('deleted_at', { useTz: true })
  })

  await knex.raw(`
    CREATE INDEX idx_chat_messages_cursor
      ON chat_messages (campaign_id, channel_id, created_at DESC, id DESC)
  `)
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_chat_messages_cursor')
  await knex.schema.dropTableIfExists('chat_messages')
}
