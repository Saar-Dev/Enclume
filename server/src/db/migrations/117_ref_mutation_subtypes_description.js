// 117_ref_mutation_subtypes_description.js
// Ajoute la colonne description sur ref_mutation_subtypes (sous-table CGA, D4).
// Backfill des 4 lignes avec le texte déjà rédigé dans creation.json
// (step3.mutations.20.subtypes.*.desc) — texte déplacé, pas de nouvelle rédaction.

const DESCRIPTIONS = {
  1: "COO +2, pas sujet au vertige, +3 Acrobatie/Équilibre. Griffes et Vision nocturne à -1 PC.",
  2: "CON +1, très bon odorat (+3 Perception odorat). Crocs gratuit.",
  3: "COO +1, odorat langue bifide (+3 Perception), +3 Évasion, se faufile dans espaces étroits.",
  4: "FOR +1, COO +1, +3 Escalade. Queue gratuite.",
}

export const up = async (knex) => {
  await knex.schema.alterTable('ref_mutation_subtypes', (table) => {
    table.text('description').nullable()
  })

  for (const [subtypeId, description] of Object.entries(DESCRIPTIONS)) {
    await knex('ref_mutation_subtypes').where({ subtype_id: Number(subtypeId) }).update({ description })
  }
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_mutation_subtypes', (table) => {
    table.dropColumn('description')
  })
}
