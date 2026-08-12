/**
 * Migration 233 — exo_sheet
 *
 * Étend characters.type pour couvrir la catégorie 'exo' (exo-armures, docs/PLANS/PLAN_EXOARMURE.md).
 * Patron repris de 71_drone_sheet.js : extension du CHECK + fiche dédiée (PK character_id),
 * pas de passage par charStats.js/char_sheet (pipeline humain).
 *
 * Tables créées :
 *   1. ref_exo_templates — catalogue des modèles (comme ref_equipment, migration 48)
 *   2. exo_sheet         — instance (comme drone_sheet, migration 71)
 *
 * Contenu restauré (2026-08-12, SCHEMADRIFT-EXOTEMPLATES1) à ce qui a été réellement exécuté le
 * 2026-08-06 09:50:27 (knex_migrations). Ce fichier avait été édité après cette exécution pour
 * ajouter 8 colonnes/2 contraintes sur `ref_exo_templates` (mode de déplacement, `speeds_extra`,
 * descriptif/commerce — cf. PLAN_EXOARMURE.md §7.5), sous l'hypothèse erronée qu'il n'avait pas
 * encore tourné. Une migration déjà appliquée ne se retouche jamais (CLAUDE.md §5) : ces colonnes
 * vivent désormais dans `243_ref_exo_templates_movement_and_commerce.js`, qui les ajoute pour de bon.
 */

export const up = async (knex) => {
  // 1 — Étendre le CHECK type pour inclure 'exo'
  await knex.raw(`
    ALTER TABLE characters DROP CONSTRAINT chk_character_type;
    ALTER TABLE characters ADD CONSTRAINT chk_character_type
      CHECK (type IN ('pj', 'pnj', 'drone', 'exo'));
  `)

  // 2 — Catalogue des modèles d'exo-armure
  await knex.schema.createTable('ref_exo_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.text('name').notNullable()
    t.text('category').notNullable()
    t.text('environment').notNullable()
    t.integer('depth_operational')
    t.integer('depth_limit')
    t.integer('depth_crush')
    t.integer('base_exoforce').notNullable().defaultTo(0)
    t.integer('base_speed_underwater')
    t.integer('base_speed_surface')
    t.integer('base_blindage').notNullable().defaultTo(0)
    t.integer('malus_init_underwater').notNullable().defaultTo(0)
    t.integer('malus_init_surface').notNullable().defaultTo(0)

    t.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE ref_exo_templates
      ADD CONSTRAINT chk_exo_template_category CHECK (category IN
        ('exo-alpha', 'exo-0', 'exo-1', 'exo-2', 'exo-3', 'exo-4', 'exo-5', 'exo-6', 'exo-omega')),
      ADD CONSTRAINT chk_exo_template_environment CHECK (environment IN
        ('submarine', 'surface', 'hybrid', 'atmospheric', 'spatial', 'industrial'))
  `)

  // 3 — Fiche exo-armure (1 ligne par exo-armure, PK = character_id)
  await knex.schema.createTable('exo_sheet', (t) => {
    t.uuid('character_id').primary().references('id').inTable('characters').onDelete('CASCADE')
    t.uuid('template_id').references('id').inTable('ref_exo_templates').onDelete('SET NULL')
    t.uuid('pilot_character_id').references('id').inTable('characters').onDelete('SET NULL')

    t.integer('itg_structure_max').notNullable().defaultTo(20)
    t.integer('itg_structure_current').notNullable().defaultTo(20)
    t.integer('itg_exosquelette_max').notNullable().defaultTo(20)
    t.integer('itg_exosquelette_current').notNullable().defaultTo(20)
    t.integer('itg_generator_max').notNullable().defaultTo(20)
    t.integer('itg_generator_current').notNullable().defaultTo(20)

    t.integer('avaries_legeres').notNullable().defaultTo(0)
    t.integer('avaries_moyennes').notNullable().defaultTo(0)
    t.integer('avaries_graves').notNullable().defaultTo(0)
    t.integer('avaries_critiques').notNullable().defaultTo(0)
    t.integer('avaries_catastrophiques').notNullable().defaultTo(0)

    t.jsonb('equipped_systems').notNullable().defaultTo('[]')
    t.jsonb('hardpoints').notNullable().defaultTo('{}')
    t.jsonb('isolated_systems').notNullable().defaultTo('[]')
    t.jsonb('damaged_systems').notNullable().defaultTo('{}')

    t.timestamps(true, true)
  })

  // Un personnage ne pilote jamais plus d'une exo-armure à la fois — index unique partiel
  // (plusieurs NULL restent autorisés, seule une valeur non-nulle en double est rejetée).
  await knex.raw(`
    CREATE UNIQUE INDEX exo_sheet_pilot_unique ON exo_sheet(pilot_character_id)
      WHERE pilot_character_id IS NOT NULL
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('exo_sheet')
  await knex.schema.dropTableIfExists('ref_exo_templates')
  // Supprimer les exo-armures avant de restaurer la contrainte (type='exo' invaliderait le CHECK)
  await knex('characters').where({ type: 'exo' }).delete()
  await knex.raw(`
    ALTER TABLE characters DROP CONSTRAINT chk_character_type;
    ALTER TABLE characters ADD CONSTRAINT chk_character_type
      CHECK (type IN ('pj', 'pnj', 'drone'));
  `)
}
