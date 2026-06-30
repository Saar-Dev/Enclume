// 96_char_creation_tables.js
// Tables de création de personnage : char_mutations (UUID PK + index partiels),
// char_polaris, char_personal_advantages, char_careers, char_traits.
// Vue char_mutation_effects_view créée EN DERNIER (dépend de char_mutations + ref_mutations/95).
//
// Source : docs/Character/Creation/migrations/95_create_char_mutations_polaris_advantages_careers_traits.cjs
// Corrections apportées :
//   - PK char_mutations : UUID (au lieu de composite nullable) + 2 index partiels
//   - knex.schema.raw() → knex.raw()
//   - CREATE VIEW déplacée après toutes les tables

exports.up = async (knex) => {
  // ─── char_mutations ────────────────────────────────────────────────────────
  // PK UUID surrogate : évite le problème du PK composite avec subtype_id nullable.
  // Unicité garantie par deux index partiels (pattern professionnel PG 12+).

  await knex.schema.createTable('char_mutations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.integer('mutation_id').notNullable()
    table.integer('subtype_id').nullable()
      .references('subtype_id').inTable('ref_mutation_subtypes')
    table.text('source').notNullable().defaultTo('chosen')
    table.text('status').notNullable().defaultTo('active')
    table.integer('count').defaultTo(1)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
  })

  // Un personnage ne peut avoir la même mutation (sans sous-type) qu'une seule fois.
  await knex.raw(`
    CREATE UNIQUE INDEX uq_char_mut_no_sub
      ON char_mutations (char_sheet_id, mutation_id)
      WHERE subtype_id IS NULL
  `)

  // Un personnage ne peut avoir la même combinaison mutation+sous-type qu'une seule fois.
  await knex.raw(`
    CREATE UNIQUE INDEX uq_char_mut_with_sub
      ON char_mutations (char_sheet_id, mutation_id, subtype_id)
      WHERE subtype_id IS NOT NULL
  `)

  await knex.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random')),
    ADD CONSTRAINT chk_char_mutations_status CHECK (status IN ('active', 'removed'))
  `)

  // ─── char_polaris ──────────────────────────────────────────────────────────

  await knex.schema.createTable('char_polaris', (table) => {
    table.uuid('char_sheet_id').primary()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('state').notNullable()
    table.jsonb('powers')
  })

  // ─── char_personal_advantages ─────────────────────────────────────────────
  // Traits narratifs libres issus du background (Step 4) — distinct de char_advantages V2.

  await knex.schema.createTable('char_personal_advantages', (table) => {
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('advantage_id').notNullable()
    table.text('type').notNullable()
    table.primary(['char_sheet_id', 'advantage_id'])
  })

  // ─── char_careers ─────────────────────────────────────────────────────────

  await knex.schema.createTable('char_careers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.uuid('career_id').notNullable()
      .references('id').inTable('ref_careers').onDelete('CASCADE')
    table.integer('years').notNullable()
    table.integer('savings').defaultTo(0)
    table.jsonb('pro_advantages')
    table.jsonb('random_picks')
    table.jsonb('setbacks')
  })

  // ─── char_traits ──────────────────────────────────────────────────────────

  await knex.schema.createTable('char_traits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('trait_type').notNullable()
    table.jsonb('params')
  })

  // ─── Vue ──────────────────────────────────────────────────────────────────
  // Créée EN DERNIER : nécessite char_mutations (ce fichier) + ref_mutations (migration 95).
  // BOOL_OR(col = val) retourne NULL si col est NULL pour toutes les lignes — acceptable côté frontend.

  await knex.raw(`
    CREATE VIEW char_mutation_effects_view AS
    SELECT
      cm.char_sheet_id,
      COALESCE(SUM(rm.mod_FOR), 0)          AS mod_FOR,
      COALESCE(SUM(rm.mod_CON), 0)          AS mod_CON,
      COALESCE(SUM(rm.mod_COO), 0)          AS mod_COO,
      COALESCE(SUM(rm.mod_INT), 0)          AS mod_INT,
      COALESCE(SUM(rm.mod_VOL), 0)          AS mod_VOL,
      COALESCE(SUM(rm.mod_PRE), 0)          AS mod_PRE,
      COALESCE(SUM(rm.mod_res_damage), 0)   AS mod_res_damage,
      COALESCE(SUM(rm.mod_res_shock), 0)    AS mod_res_shock,
      COALESCE(SUM(rm.mod_res_drugs), 0)    AS mod_res_drugs,
      COALESCE(SUM(rm.mod_res_disease), 0)  AS mod_res_disease,
      COALESCE(SUM(rm.mod_res_poison), 0)   AS mod_res_poison,
      COALESCE(SUM(rm.mod_res_radiation), 0) AS mod_res_radiation,
      COALESCE(SUM(rm.natural_armor), 0)    AS natural_armor,
      BOOL_OR(rm.mod_sex = 'androgyne')     AS is_androgyne,
      BOOL_OR(rm.mod_sex = 'asexue')        AS is_asexue,
      BOOL_OR(rm.mod_fertility = 'sterile') AS is_sterile,
      BOOL_OR(rm.mod_fertility = 'self_fertile') AS is_self_fertile,
      STRING_AGG(rm.special_effect, ' | ')
        FILTER (WHERE rm.special_effect IS NOT NULL) AS special_effects
    FROM char_mutations cm
    JOIN ref_mutations rm ON rm.mutation_id = cm.mutation_id
    WHERE cm.status = 'active'
    GROUP BY cm.char_sheet_id
  `)
}

exports.down = async (knex) => {
  await knex.raw('DROP VIEW IF EXISTS char_mutation_effects_view')
  await knex.schema.dropTableIfExists('char_traits')
  await knex.schema.dropTableIfExists('char_careers')
  await knex.schema.dropTableIfExists('char_personal_advantages')
  await knex.schema.dropTableIfExists('char_polaris')
  await knex.schema.dropTableIfExists('char_mutations')
}
