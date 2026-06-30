// 094_drop_char_advantages_ref_avantages.cjs
export const up = async (knex) => {
  await knex.schema.dropTableIfExists('char_advantages')
  await knex.schema.dropTableIfExists('ref_avantages')
  // DROP ancienne ref_mutations (migration 38, schema muta_numero TEXT PK).
  // char_advantages (fk vers muta_numero) est déjà supprimée ci-dessus — CASCADE propre.
  // La nouvelle ref_mutations (mutation_id INTEGER PK) est créée dans la migration 95 suivante.
  await knex.raw('DROP TABLE IF EXISTS ref_mutations CASCADE')
}

export const down = async (knex) => {
  // ATTENTION : la reconstruction de l'ancienne ref_mutations (muta_numero TEXT PK, 33 mutations)
  // n'est pas possible ici — données irrecouvrables en rollback partiel.
  // Pour un rollback complet, restaurer depuis un backup ou ré-exécuter depuis migration 38.

  // Recréer char_advantages (migration 40 d'origine)
  await knex.schema.createTable('char_advantages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('type').notNullable()
    table.text('label')
    table.integer('value').defaultTo(0)
    table.timestamps(true, true)
  })

  // Recréer ref_avantages (migration 92 d'origine, incomplète)
  await knex.schema.createTable('ref_avantages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.text('numero').notNullable().unique()
    table.text('nom').notNullable()
    table.text('type').notNullable()
    table.text('famille')
    table.integer('cout_pc').defaultTo(0)
    table.text('description')
    table.boolean('est_unique').defaultTo(false)
    table.boolean('est_unique_par_famille').defaultTo(false)
    table.boolean('famille_exclusive').defaultTo(false)
    table.jsonb('mod_attribut')
    table.jsonb('mod_resistance')
    table.jsonb('mod_conditions')
    table.text('capacite_speciale')
    table.timestamps(true, true)
  })
}
