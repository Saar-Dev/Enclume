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

    // Vitesse — vérifié contre 16 armures RAW réelles (REGLEARMURE.md p.339-348) : une simple paire
    // d'entiers ne suffit pas. 3 cas réels au-delà de "une valeur numérique normale" :
    //   - "à terre : capacité de déplacement du personnage" (Explora) → mode='pilot', le mouvement
    //     redirige vers le pilote humain (getCharacterMovementBudget récursif), base_speed_* ignorée.
    //   - "à terre : -" (Vulcain, incapable de se déplacer hors de l'eau) → mode='blocked'.
    //   - Un même milieu offre souvent 2 valeurs (ex. "10 exo-palmes / 20 propulseur" sous l'eau) —
    //     RAW (REGLEARMURE.md:249-255) : seul le déplacement naturel compte pour le mouvement de
    //     combat standard (un propulseur project hors de portée en 1-2 Tours, mécanique d'évasion
    //     narrative distincte, pas un choix d'Allure). base_speed_* porte donc uniquement le mode
    //     naturel ; les modes secondaires vont dans speeds_extra (narratif, non consommé par
    //     movementBudgetService).
    t.integer('base_speed_underwater')
    t.integer('base_speed_surface')
    t.text('underwater_movement_mode').notNullable().defaultTo('vit')
    t.text('surface_movement_mode').notNullable().defaultTo('vit')
    t.jsonb('speeds_extra').notNullable().defaultTo('[]')

    t.integer('base_blindage').notNullable().defaultTo(0)
    t.integer('malus_init_underwater').notNullable().defaultTo(0)
    t.integer('malus_init_surface').notNullable().defaultTo(0)

    // Descriptif/commerce — présents dans 100% des exemples RAW (REGLEARMURE.md p.339-348), absents
    // du schéma initial. tech_level en texte (pas un entier comme ref_equipment.tech_level) : la
    // source donne "III", "III-IV"... jamais un entier propre.
    t.text('manufacturer')
    t.integer('price')
    t.text('rarity')
    t.text('tech_level')
    t.text('autonomy')

    t.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE ref_exo_templates
      ADD CONSTRAINT chk_exo_template_category CHECK (category IN
        ('exo-alpha', 'exo-0', 'exo-1', 'exo-2', 'exo-3', 'exo-4', 'exo-5', 'exo-6', 'exo-omega')),
      ADD CONSTRAINT chk_exo_template_environment CHECK (environment IN
        ('submarine', 'surface', 'hybrid', 'atmospheric', 'spatial', 'industrial')),
      ADD CONSTRAINT chk_exo_template_underwater_mode CHECK (underwater_movement_mode IN
        ('vit', 'pilot', 'blocked')),
      ADD CONSTRAINT chk_exo_template_surface_mode CHECK (surface_movement_mode IN
        ('vit', 'pilot', 'blocked'))
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
