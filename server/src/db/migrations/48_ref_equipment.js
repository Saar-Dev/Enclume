/**
 * Migration 48 — ref_equipment
 *
 * Catalogue de référence statique des équipements Polaris.
 * Schéma défini et validé session 46 — JOURNALBDD.md fait foi.
 * Données saisies manuellement par le GM.
 *
 * Tables créées (dans l'ordre des dépendances) :
 *   1. ref_equipment            — catalogue principal
 *   2. ref_equipment_skills     — items ↔ compétences boostées/requises
 *   3. ref_equipment_skill_assoc — items ↔ compétences d'utilisation
 *   4. ref_equipment_ammo_compat — munitions ↔ armes éligibles (auto-référence)
 */

export const up = async (knex) => {

  // 1. Table principale
  await knex.schema.createTable('ref_equipment', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    // Identité
    table.text('family').notNullable()
    table.text('category').notNullable()
    table.text('name').notNullable()
    table.text('description')

    // Prix
    table.integer('price')
    table.string('price_modifier', 50)

    // Caractéristiques générales
    table.float('weight')
    table.integer('tech_level').notNullable()
    table.string('manufacturer', 50)
    table.string('bonus', 50)
    table.integer('max_level')
    table.string('nation', 50)

    // Offensif
    table.string('damage_h', 50)
    table.string('damage_v_low', 50)
    table.string('damage_v_high', 50)
    table.string('shock', 50)
    table.string('range', 50)
    table.integer('min_str')
    table.integer('init_mod')
    table.string('fire_mode', 20)
    table.string('ammo_count', 50)
    table.string('ammo_cost', 50)
    table.string('caliber', 50)

    // Disponibilité
    table.string('rarity', 20).notNullable().defaultTo('20(20)')

    // Compétences / Attributs — attribut uniquement (compétences via junction table)
    table.text('linked_attr')

    // Défensif
    table.integer('protection')
    table.string('protection_modifier', 50)
    table.integer('protection_shock')
    table.string('location', 50)
    table.text('malus_cat')

    // Conteneur
    table.float('capacity')
    table.boolean('waterproof')

    // Munitions
    table.text('ammo_effects')

    table.timestamps(true, true)
  })

  // CHECK constraints — raw SQL pour fiabilité maximale indépendamment de la version Knex
  await knex.raw(`
    ALTER TABLE ref_equipment
      ADD CONSTRAINT chk_eq_tech_level  CHECK (tech_level BETWEEN 1 AND 7),
      ADD CONSTRAINT chk_eq_min_str     CHECK (min_str IS NULL OR min_str BETWEEN 3 AND 20),
      ADD CONSTRAINT chk_eq_init_mod    CHECK (init_mod IS NULL OR init_mod < 0),
      ADD CONSTRAINT chk_eq_fire_mode   CHECK (fire_mode IS NULL OR fire_mode IN ('CC','RC','RL','CC/RC','CC/RL','RC/RL','CC/RC/RL','-')),
      ADD CONSTRAINT chk_eq_linked_attr CHECK (linked_attr IS NULL OR linked_attr IN ('FOR','CON','COO','ADA','PER','INT','VOL','PRE')),
      ADD CONSTRAINT chk_eq_malus_cat   CHECK (malus_cat IS NULL OR malus_cat IN ('S','A','B','C','D'))
  `)

  // 2. Junction : items ↔ compétences boostées/requises
  await knex.schema.createTable('ref_equipment_skills', (table) => {
    table.uuid('item_id').notNullable()
      .references('id').inTable('ref_equipment').onDelete('CASCADE')
    table.text('skill_id').notNullable()
      .references('id').inTable('ref_skills').onDelete('RESTRICT')
    table.primary(['item_id', 'skill_id'])
  })

  // 3. Junction : items ↔ compétences d'utilisation
  await knex.schema.createTable('ref_equipment_skill_assoc', (table) => {
    table.uuid('item_id').notNullable()
      .references('id').inTable('ref_equipment').onDelete('CASCADE')
    table.text('skill_id').notNullable()
      .references('id').inTable('ref_skills').onDelete('RESTRICT')
    table.primary(['item_id', 'skill_id'])
  })

  // 4. Junction : munitions ↔ armes éligibles (auto-référence sur ref_equipment)
  await knex.schema.createTable('ref_equipment_ammo_compat', (table) => {
    table.uuid('ammo_id').notNullable()
      .references('id').inTable('ref_equipment').onDelete('CASCADE')
    table.uuid('weapon_id').notNullable()
      .references('id').inTable('ref_equipment').onDelete('CASCADE')
    table.primary(['ammo_id', 'weapon_id'])
  })
}

export const down = async (knex) => {
  // Ordre inverse des dépendances
  await knex.schema.dropTableIfExists('ref_equipment_ammo_compat')
  await knex.schema.dropTableIfExists('ref_equipment_skill_assoc')
  await knex.schema.dropTableIfExists('ref_equipment_skills')
  await knex.schema.dropTableIfExists('ref_equipment')
}
