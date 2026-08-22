// Correction schéma drone_sheet :
// - Suppression des champs sans source LdB (iv, survie_iem, resistance_dommages,
//   architecture, structure_materiau)
// - Ajout des champs manquants (profondeur_max, disponibilite)
export const up = async (knex) => {
  await knex.schema.alterTable('drone_sheet', (t) => {
    t.dropColumn('iv')
    t.dropColumn('survie_iem')
    t.dropColumn('resistance_dommages')
    t.dropColumn('architecture')
    t.dropColumn('structure_materiau')
    t.text('profondeur_max')
    t.text('disponibilite')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('drone_sheet', (t) => {
    t.integer('iv')
    t.integer('survie_iem')
    t.integer('resistance_dommages').defaultTo(0)
    t.text('architecture')
    t.text('structure_materiau')
    t.dropColumn('profondeur_max')
    t.dropColumn('disponibilite')
  })
}
