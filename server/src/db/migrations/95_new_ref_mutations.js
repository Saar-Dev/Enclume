// 95_new_ref_mutations.js
// Crée les 5 tables de mutations normalisées.
// Remplace ref_mutations v1 (muta_numero TEXT PK, migration 38) supprimée par migration 94.
// Le seed est dans 95_seed_ref_mutations.js (trie après ce fichier : 's' > 'n').

exports.up = async (knex) => {
  await knex.schema.createTable('ref_mutations', (table) => {
    table.increments('mutation_id').primary()
    table.string('name', 100).notNullable().unique()
    table.string('subtype', 50).nullable()
    table.boolean('has_subtable').notNullable().defaultTo(false)
    table.integer('cost_pc').notNullable().defaultTo(0)
    table.boolean('is_unique').notNullable().defaultTo(false)
    table.boolean('is_stackable').notNullable().defaultTo(false)
    table.integer('stack_limit').nullable()
    table.string('stack_effect', 100).nullable()
    table.integer('mod_FOR').notNullable().defaultTo(0)
    table.integer('mod_CON').notNullable().defaultTo(0)
    table.integer('mod_COO').notNullable().defaultTo(0)
    table.integer('mod_INT').notNullable().defaultTo(0)
    table.integer('mod_VOL').notNullable().defaultTo(0)
    table.integer('mod_PRE').notNullable().defaultTo(0)
    table.integer('mod_res_damage').notNullable().defaultTo(0)
    table.integer('mod_res_shock').notNullable().defaultTo(0)
    table.integer('mod_res_drugs').notNullable().defaultTo(0)
    table.integer('mod_res_disease').notNullable().defaultTo(0)
    table.integer('mod_res_poison').notNullable().defaultTo(0)
    table.integer('mod_res_radiation').notNullable().defaultTo(0)
    table.integer('natural_armor').notNullable().defaultTo(0)
    table.string('mod_sex', 20).nullable()
    table.string('mod_fertility', 20).nullable()
    table.string('max_cumul_group', 50).nullable()
    table.integer('max_cumul_limit').nullable()
    table.text('special_effect').nullable()
    table.integer('d100_range_start').nullable()
    table.integer('d100_range_end').nullable()
    table.integer('ldb_page').nullable()
    table.text('description').notNullable()
    table.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE ref_mutations
    ADD CONSTRAINT chk_mut_subtype CHECK (
      subtype IS NULL OR subtype IN (
        'minor','major',
        'taste','smell','touch','hearing','sight',
        'fire','cold','drugs','disease','poison','radiation'
      )
    ),
    ADD CONSTRAINT chk_mut_sex CHECK (mod_sex IS NULL OR mod_sex IN ('androgyne','asexue')),
    ADD CONSTRAINT chk_mut_fertility CHECK (mod_fertility IS NULL OR mod_fertility IN ('sterile','self_fertile'))
  `)

  await knex.schema.createTable('ref_mutation_subtypes', (table) => {
    table.increments('subtype_id').primary()
    table.integer('mutation_id').notNullable()
      .references('mutation_id').inTable('ref_mutations').onDelete('CASCADE')
    table.string('name', 100).notNullable()
    table.integer('d4_roll').notNullable()
    table.integer('mod_FOR').notNullable().defaultTo(0)
    table.integer('mod_CON').notNullable().defaultTo(0)
    table.integer('mod_COO').notNullable().defaultTo(0)
    table.integer('mod_INT').notNullable().defaultTo(0)
    table.integer('mod_VOL').notNullable().defaultTo(0)
    table.integer('mod_PRE').notNullable().defaultTo(0)
    table.string('skill_bonus').nullable()
    table.string('immunity').nullable()
    table.text('special_trait').nullable()
    table.unique(['mutation_id', 'd4_roll'])
  })

  await knex.raw(`
    ALTER TABLE ref_mutation_subtypes
    ADD CONSTRAINT chk_sub_d4 CHECK (d4_roll BETWEEN 1 AND 4)
  `)

  await knex.schema.createTable('ref_mutation_skills', (table) => {
    table.integer('mutation_id').notNullable()
      .references('mutation_id').inTable('ref_mutations').onDelete('CASCADE')
    table.string('skill_name', 100).notNullable()
    table.string('skill_attrs', 10).notNullable()
    table.integer('skill_base').notNullable()
    table.decimal('cost_mult', 3, 1).notNullable().defaultTo(1.0)
    table.primary(['mutation_id', 'skill_name'])
  })

  await knex.schema.createTable('ref_mutation_discounts', (table) => {
    table.integer('mutation_id').notNullable()
      .references('mutation_id').inTable('ref_mutations').onDelete('CASCADE')
    table.integer('target_mutation_id').notNullable()
      .references('mutation_id').inTable('ref_mutations').onDelete('CASCADE')
    table.integer('discount_amount').notNullable().defaultTo(1)
    table.primary(['mutation_id', 'target_mutation_id'])
  })

  await knex.schema.createTable('ref_mutation_incompatibilities', (table) => {
    table.integer('mutation_id_a').notNullable()
      .references('mutation_id').inTable('ref_mutations').onDelete('CASCADE')
    table.integer('mutation_id_b').notNullable()
      .references('mutation_id').inTable('ref_mutations').onDelete('CASCADE')
    table.primary(['mutation_id_a', 'mutation_id_b'])
  })

  await knex.raw(`
    ALTER TABLE ref_mutation_incompatibilities
    ADD CONSTRAINT chk_inc_order CHECK (mutation_id_a < mutation_id_b)
  `)
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_mutation_incompatibilities')
  await knex.schema.dropTableIfExists('ref_mutation_discounts')
  await knex.schema.dropTableIfExists('ref_mutation_skills')
  await knex.schema.dropTableIfExists('ref_mutation_subtypes')
  await knex.schema.dropTableIfExists('ref_mutations')
}
