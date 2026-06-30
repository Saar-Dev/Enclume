// 093_ref_careers.cjs

exports.up = async (knex) => {
  // 1. Careers
  await knex.schema.createTable('ref_careers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table.text('code').notNullable().unique()
    table.text('name').notNullable()
    table.text('illustration')
    table.text('description')

    table.boolean('restricted_geographic_origin').defaultTo(false)
    table.text('geographic_origin_details')

    table.text('required_genotype')

    table.integer('min_for')
    table.integer('min_con')
    table.integer('min_coo')
    table.integer('min_ada')
    table.integer('min_per')
    table.integer('min_int')
    table.integer('min_vol')
    table.integer('min_pre')

    table.text('min_attributes_logic').defaultTo('AND')

    table.integer('contact_frequency')

    table.integer('ally_frequency')
    table.text('ally_type').defaultTo('ally_or_supplier')

    table.integer('opponent_frequency')
    table.text('enemy_rule')

    table.integer('points_per_year').defaultTo(5)

    table.timestamps(true, true)
  })

  // 2. Career skills
  await knex.schema.createTable('ref_career_skills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.text('skill_id').notNullable()
    table.text('skill_group')
    table.boolean('conditional').defaultTo(false)

    table.index(['career_id'])
  })

  // 3. Career titles
  await knex.schema.createTable('ref_career_titles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.integer('min_years').notNullable()
    table.integer('max_years')

    table.text('title').notNullable()

    table.integer('salary_per_year')
    table.text('salary_formula')

    table.unique(['career_id', 'min_years'])
    table.index(['career_id'])
  })

  // 4. Career prerequisites
  await knex.schema.createTable('ref_career_prerequisites', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table
      .uuid('prerequisite_career_id')
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.integer('min_years').notNullable()
    table.text('prerequisite_logic').defaultTo('AND')

    table.index(['career_id'])
    table.index(['prerequisite_career_id'])
  })

  // 5. Required education
  await knex.schema.createTable('ref_career_education', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.text('field').notNullable()

    table.index(['career_id'])
  })

  // 6. Random benefits
  await knex.schema.createTable('ref_career_random_benefits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.integer('roll').notNullable()
    table.text('description').notNullable()

    table.check('roll BETWEEN 1 AND 10')

    table.index(['career_id'])
  })

  // 7. Equipment
  await knex.schema.createTable('ref_career_equipment', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.integer('sort_order').notNullable()
    table.text('equipment').notNullable()

    table.unique(['career_id', 'sort_order'])
    table.index(['career_id'])
  })

  // 8. Point categories
  await knex.schema.createTable('ref_career_point_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    table
      .uuid('career_id')
      .notNullable()
      .references('id')
      .inTable('ref_careers')
      .onDelete('CASCADE')

    table.integer('sort_order').notNullable()
    table.text('category').notNullable()

    table.unique(['career_id', 'sort_order'])
    table.index(['career_id'])
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_career_point_categories')
  await knex.schema.dropTableIfExists('ref_career_equipment')
  await knex.schema.dropTableIfExists('ref_career_random_benefits')
  await knex.schema.dropTableIfExists('ref_career_education')
  await knex.schema.dropTableIfExists('ref_career_prerequisites')
  await knex.schema.dropTableIfExists('ref_career_titles')
  await knex.schema.dropTableIfExists('ref_career_skills')
  await knex.schema.dropTableIfExists('ref_careers')
}
