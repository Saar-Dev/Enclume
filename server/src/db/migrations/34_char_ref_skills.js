/**
 * Migration 34 — char : ref_skills
 *
 * Table de référence statique du catalogue des compétences Polaris.
 * Structure uniquement — seed à effectuer manuellement (catalogue trop volumineux).
 *
 * Colonnes :
 *   id          — identifiant technique unique (ex: 'ACROBATIE', 'ARTS_MARTIAUX_LUTTE')
 *   family      — famille d'affichage (ex: 'Physique', 'Combat (contact)')
 *   label       — nom affiché sur la fiche
 *   parent      — NULL si compétence racine, sinon id de la compétence parente
 *                 (ex: 'ARTS_MARTIAUX' pour Lutte, Tech. défensives, Tech. offensives)
 *   attr_1      — code attribut 1 (ex: 'COO')
 *   attr_2      — code attribut 2, NULL si attr_1 utilisé x2 (ex: FOR/FOR)
 *   marker      — NULL=Standard | 'DIFF'=(-3) | 'RES_X'=(X) réservée
 *                 'LIMIT'=(•) limitative | 'PN'=Progression Naturelle
 *   description — texte tooltip affiché sur la fiche
 */

export const up = async (knex) => {
  await knex.schema.createTable('ref_skills', (table) => {
    table.text('id').primary()
    table.text('family').notNullable()
    table.text('label').notNullable()
    table.text('parent').defaultTo(null)
    table.text('attr_1').notNullable()
    table.text('attr_2').defaultTo(null)         // NULL = attr_1 x2
    table.text('marker').defaultTo(null)
    table.text('description').defaultTo(null)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_skills')
}
