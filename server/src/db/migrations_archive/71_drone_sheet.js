export const up = async (knex) => {
  // 1 — Étendre le CHECK type pour inclure 'drone'
  await knex.raw(`
    ALTER TABLE characters DROP CONSTRAINT chk_character_type;
    ALTER TABLE characters ADD CONSTRAINT chk_character_type
      CHECK (type IN ('pj', 'pnj', 'drone'));
  `)

  // 2 — Fiche drone (1 ligne par drone, PK = character_id)
  await knex.schema.createTable('drone_sheet', (t) => {
    t.uuid('character_id').primary().references('id').inTable('characters').onDelete('CASCADE')

    // Stats descriptives
    t.integer('taille')
    t.integer('poids')
    t.integer('vitesse')
    t.text('nt')
    t.integer('iv')
    t.text('source_energie')
    t.text('autonomie')
    t.text('mode_deplacement')

    // Défense
    t.integer('blindage').defaultTo(0)
    t.integer('blindage_iem').defaultTo(0)
    t.integer('survie_iem')
    t.integer('resistance_dommages').defaultTo(0)

    // Ordinateur embarqué
    t.smallint('ordinateur_gen')
    t.smallint('ordinateur_nt')

    // Guide Technique
    t.text('echelle').defaultTo('H')
    t.text('architecture')
    t.text('structure_materiau')
    t.text('armure_materiau')

    // Intégrité (1 seule localisation)
    // localisation_ref fixé à la création — non modifiable via PUT /drone
    // (changer la valeur invaliderait le JSONB damages)
    t.text('localisation_ref').defaultTo('corps')
    t.integer('integrite_max').defaultTo(15)
    t.integer('integrite_actuelle').defaultTo(15)
    t.jsonb('damages').notNullable().defaultTo('{}')

    // Divers
    t.text('equip_special')
    t.text('notes_gm')
  })

  // 3 — Programmes du drone
  await knex.schema.createTable('drone_programs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('character_id').notNullable().references('id').inTable('characters').onDelete('CASCADE')
    t.text('label').notNullable()
    t.integer('level').notNullable().checkBetween([0, 30])
    t.smallint('sort_order').defaultTo(0)
  })

  // 4 — Armement drone (remplace char_inventory pour les drones)
  await knex.schema.createTable('drone_weapons', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('character_id').notNullable().references('id').inTable('characters').onDelete('CASCADE')
    t.uuid('equipment_id').notNullable().references('id').inTable('ref_equipment')
    t.integer('contenance_chargeur').notNullable().defaultTo(0)
    t.integer('ammo_restant')
    t.smallint('sort_order').defaultTo(0)
    t.text('label_override')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('drone_weapons')
  await knex.schema.dropTableIfExists('drone_programs')
  await knex.schema.dropTableIfExists('drone_sheet')
  // Supprimer les drones avant de restaurer la contrainte (type='drone' invaliderait le CHECK)
  await knex('characters').where({ type: 'drone' }).delete()
  await knex.raw(`
    ALTER TABLE characters DROP CONSTRAINT chk_character_type;
    ALTER TABLE characters ADD CONSTRAINT chk_character_type
      CHECK (type IN ('pj', 'pnj'));
  `)
}
