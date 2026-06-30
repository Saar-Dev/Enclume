// 095_create_char_mutations_polaris_advantages_careers_traits.cjs
// Version révisée — Session 127 — ajout subtype_id, source, status à char_mutations
export const up = async (knex) => {
  await knex.schema.createTable('char_mutations', (table) => {
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.integer('mutation_id').notNullable()
    table.integer('subtype_id').references('subtype_id').inTable('ref_mutation_subtypes')
    table.text('source').notNullable().defaultTo('chosen')
    table.text('status').notNullable().defaultTo('active')
    table.integer('count').defaultTo(1)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.primary(['char_sheet_id', 'mutation_id', 'subtype_id'])
  })

  await knex.schema.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random')),
    ADD CONSTRAINT chk_char_mutations_status CHECK (status IN ('active', 'removed'))
  `)

  await knex.schema.raw(`
    CREATE VIEW char_mutation_effects_view AS
    SELECT 
      cm.char_sheet_id,
      COALESCE(SUM(rm.mod_FOR), 0) AS mod_FOR,
      COALESCE(SUM(rm.mod_CON), 0) AS mod_CON,
      COALESCE(SUM(rm.mod_COO), 0) AS mod_COO,
      COALESCE(SUM(rm.mod_INT), 0) AS mod_INT,
      COALESCE(SUM(rm.mod_VOL), 0) AS mod_VOL,
      COALESCE(SUM(rm.mod_PRE), 0) AS mod_PRE,
      COALESCE(SUM(rm.mod_res_damage), 0) AS mod_res_damage,
      COALESCE(SUM(rm.mod_res_shock), 0) AS mod_res_shock,
      COALESCE(SUM(rm.mod_res_drugs), 0) AS mod_res_drugs,
      COALESCE(SUM(rm.mod_res_disease), 0) AS mod_res_disease,
      COALESCE(SUM(rm.mod_res_poison), 0) AS mod_res_poison,
      COALESCE(SUM(rm.mod_res_radiation), 0) AS mod_res_radiation,
      COALESCE(SUM(rm.natural_armor), 0) AS natural_armor,
      BOOL_OR(rm.mod_sex = 'androgyne') AS is_androgyne,
      BOOL_OR(rm.mod_sex = 'asexue') AS is_asexue,
      BOOL_OR(rm.mod_fertility = 'sterile') AS is_sterile,
      BOOL_OR(rm.mod_fertility = 'self_fertile') AS is_self_fertile,
      STRING_AGG(rm.special_effect, ' | ') FILTER (WHERE rm.special_effect IS NOT NULL) AS special_effects
    FROM char_mutations cm
    JOIN ref_mutations rm ON rm.mutation_id = cm.mutation_id
    WHERE cm.status = 'active'
    GROUP BY cm.char_sheet_id
  `)

  await knex.schema.createTable('char_polaris', (table) => {
    table.uuid('char_sheet_id').primary().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('state').notNullable()
    table.jsonb('powers')
  })

  await knex.schema.createTable('char_personal_advantages', (table) => {
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('advantage_id').notNullable()
    table.text('type').notNullable()
    table.primary(['char_sheet_id', 'advantage_id'])
  })

  await knex.schema.createTable('char_careers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.uuid('career_id').notNullable().references('id').inTable('ref_careers').onDelete('CASCADE')
    table.integer('years').notNullable()
    table.integer('savings').defaultTo(0)
    table.jsonb('pro_advantages')
    table.jsonb('random_picks')
    table.jsonb('setbacks')
  })

  await knex.schema.createTable('char_traits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('trait_type').notNullable()
    table.jsonb('params')
  })
}

export const down = async (knex) => {
  await knex.schema.raw('DROP VIEW IF EXISTS char_mutation_effects_view')
  await knex.schema.dropTableIfExists('char_traits')
  await knex.schema.dropTableIfExists('char_careers')
  await knex.schema.dropTableIfExists('char_personal_advantages')
  await knex.schema.dropTableIfExists('char_polaris')
  await knex.schema.dropTableIfExists('char_mutations')
}