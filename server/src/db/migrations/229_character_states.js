// 229_character_states.js
// docs/PLANS/PLAN_CHARACTER_STATES.md §2.1 — Lot 0 (additif pur, rien de consommé encore).
// Déplace l'autorité de state_position/state_weapon hors de combat_roster (éphémère, supprimée à
// COMBAT_END) vers une entité durable ancrée sur token_id (§0.3bis — pas character_id : un GM peut
// poser plusieurs tokens partageant le même character_id, chacun avec son propre état physique).
// combat_roster.state_position/state_weapon restent l'autorité en prod tant que le Lot 2b n'a pas
// basculé la lecture — cette migration n'y touche pas.

const POSITION_VALUES = [
  { axis: 'position', value_code: 'standing',  label: 'Debout' },
  { axis: 'position', value_code: 'crouching', label: 'Accroupi' },
  { axis: 'position', value_code: 'kneeling',  label: 'À genou' }, // manquait au code (§0.2), présent LdB REGLESYSCOMBAT.md:929-930
  { axis: 'position', value_code: 'prone',     label: 'Couché' }, // libellé aligné sur combat.json (client), pas sur "allongé" (LdB) — dette i18n existante, non aggravée ici
]

const WEAPON_VALUES = [
  { axis: 'weapon', value_code: 'holstered', label: 'Rangée' },
  { axis: 'weapon', value_code: 'ready',     label: "Main sur l'arme" },
  { axis: 'weapon', value_code: 'drawn',     label: 'Au clair' },
]

export const up = async (knex) => {
  await knex.schema.createTable('ref_character_state_values', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.text('axis').notNullable()
    table.text('value_code').notNullable()
    table.text('label').notNullable()
  })
  await knex.raw(`
    ALTER TABLE ref_character_state_values
      ADD CONSTRAINT uq_char_state_values_axis_code UNIQUE (axis, value_code)
  `)

  await knex('ref_character_state_values').insert([...POSITION_VALUES, ...WEAPON_VALUES])

  await knex.schema.createTable('character_states', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    table.text('axis').notNullable()
    table.text('value_code').notNullable()
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`
    ALTER TABLE character_states
      ADD CONSTRAINT uq_char_states_token_axis UNIQUE (token_id, axis),
      ADD CONSTRAINT fk_char_states_axis_code
        FOREIGN KEY (axis, value_code)
        REFERENCES ref_character_state_values (axis, value_code)
  `)
  await knex.raw('CREATE INDEX idx_char_states_token ON character_states(token_id)')
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('character_states')
  await knex.schema.dropTableIfExists('ref_character_state_values')
}
