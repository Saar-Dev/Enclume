/**
 * Migration 36 — char : tables dynamiques personnage
 *
 * Crée les 5 tables de données personnage dans l'ordre strict des dépendances :
 *   1. char_sheet       — table pivot, lien vers characters (Enclume)
 *   2. char_identity    — description physique + identité
 *   3. char_archetype   — génotype + biographie
 *   4. char_attributes  — attributs primaires (une ligne par attribut)
 *   5. char_skills      — maîtrise des compétences par personnage
 *
 * Toutes les FK vers char_sheet sont ON DELETE CASCADE :
 * supprimer le character Enclume supprime toute la fiche.
 *
 * Ce qui n'est PAS stocké (calculé côté client JS uniquement) :
 *   - Modificateur génotype (lu depuis ref_genotypes)
 *   - Niveau actuel (na), Aptitude Naturelle (AN)
 *   - Score Base compétence, Total compétence
 *   - Attributs secondaires (REA, Initiative, seuils, vitesses, Mod_Dom)
 */

export const up = async (knex) => {

  // 1. Table pivot
  await knex.schema.createTable('char_sheet', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('character_id')
      .notNullable()
      .references('id').inTable('characters')
      .onDelete('CASCADE')
    table.integer('chc').defaultTo(11)    // Chance 1-20, aucun calcul
    table.timestamps(true, true)          // created_at + updated_at
  })

  // 2. Identité + description physique
  await knex.schema.createTable('char_identity', (table) => {
    table.uuid('char_sheet_id')
      .primary()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE')
    table.text('player_name')
    table.text('char_name')               // nom officiel complet (≠ token name)
    table.decimal('height', 4, 1)         // taille en m
    table.decimal('weight', 5, 1)         // poids en kg
    table.text('skin')
    table.text('eyes')
    table.text('hair')
    table.text('build')                   // corpulence
    table.text('distinctive_signs')
    table.text('hand_pref')               // 'R', 'L', 'A'
  })

  // 3. Archétype + biographie
  await knex.schema.createTable('char_archetype', (table) => {
    table.uuid('char_sheet_id')
      .primary()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE')
    table.text('genotype_id')
      .references('id').inTable('ref_genotypes')
    table.integer('age')
    table.text('sex')
    table.boolean('is_fertile').defaultTo(false)
    table.text('origin_geo')
    table.text('origin_soc')
    table.text('training_base')
    table.text('higher_ed')
  })

  // 4. Attributs primaires — une ligne par attribut par personnage
  // attr_id : 'FOR','CON','COO','ADA','PER','INT','VOL','PRE'
  await knex.schema.createTable('char_attributes', (table) => {
    table.uuid('char_sheet_id')
      .notNullable()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE')
    table.text('attr_id').notNullable()
    table.integer('base_level').notNullable().defaultTo(7)
    table.integer('pc_modifier').defaultTo(0)
    table.primary(['char_sheet_id', 'attr_id'])
  })

  // 5. Maîtrise des compétences par personnage
  await knex.schema.createTable('char_skills', (table) => {
    table.uuid('char_sheet_id')
      .notNullable()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE')
    table.text('skill_id')
      .notNullable()
      .references('id').inTable('ref_skills')
      .onDelete('CASCADE')
    table.integer('mastery').defaultTo(0)
    table.boolean('is_learned').defaultTo(false) // débloque les compétences RES_X
    table.primary(['char_sheet_id', 'skill_id'])
  })
}

export const down = async (knex) => {
  // Ordre inverse des dépendances
  await knex.schema.dropTableIfExists('char_skills')
  await knex.schema.dropTableIfExists('char_attributes')
  await knex.schema.dropTableIfExists('char_archetype')
  await knex.schema.dropTableIfExists('char_identity')
  await knex.schema.dropTableIfExists('char_sheet')
}
