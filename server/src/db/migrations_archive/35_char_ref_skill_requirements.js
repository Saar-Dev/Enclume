/**
 * Migration 35 — char : ref_skill_requirements
 *
 * Table de référence statique des prérequis de compétences.
 * Relation one-to-many vers ref_skills : une compétence peut avoir
 * zéro, un ou plusieurs prérequis de types différents.
 *
 * types :
 *   'SKILL_MIN'  — nécessite un score minimum dans une autre compétence
 *                  ex: PIRATAGE nécessite INFORMATIQUE >= 10
 *   'MUTATION'   — nécessite la possession d'une mutation
 *                  ex: AGIL_CAUDALE nécessite MUT_QUEUE
 *   'GENOTYPE'   — réservée à un génotype spécifique
 *                  ex: compétence exclusive HYB_NAT
 *
 * Seed à effectuer manuellement (dépend du seed de ref_skills).
 */

export const up = async (knex) => {
  await knex.schema.createTable('ref_skill_requirements', (table) => {
    table.text('skill_id').notNullable().references('id').inTable('ref_skills').onDelete('CASCADE')
    table.text('type').notNullable()       // 'SKILL_MIN', 'MUTATION', 'GENOTYPE'
    table.text('value').notNullable()      // ex: 'INFORMATIQUE', 'MUT_QUEUE', 'HYB_NAT'
    table.integer('threshold').defaultTo(1) // valeur minimale requise
    table.primary(['skill_id', 'type', 'value'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_skill_requirements')
}
