// 318_ref_catalog_i18n.js — docs/PLANS/PLAN_LOCALISATION.md §7.4.1
//
// Ajoute une colonne JSONB <champ>_i18n pour chaque champ traduisible des tables ref_*.
// Le FR reste l'autorité dans la colonne d'origine ; <champ>_i18n ne portera que les
// langues supplémentaires ({"en": …, "de": …}), vide {} tant que le produit est FR seul.
// DDL additif pur — aucun backfill. Résolveur : server/src/lib/refI18n.js.
//
// La map ci-dessous est la copie FIGÉE de l'état à la migration 318 ; la version vivante
// (« quels champs sont traduisibles aujourd'hui ») est REF_TRANSLATABLE dans refI18n.js.
// Les deux peuvent diverger avec le temps : un champ ajouté plus tard prend sa propre
// migration, il ne réactive pas celle-ci.

const TRANSLATABLE = {
  ref_genotypes:              ['label', 'description'],
  ref_mutation_subtypes:      ['name', 'description', 'special_trait'],
  ref_backgrounds:            ['name', 'description'],
  ref_setbacks:               ['name', 'description'],
  ref_careers:                ['name', 'description', 'geographic_origin_details'],
  ref_mutations:              ['name', 'description', 'stack_effect', 'special_effect'],
  ref_advantages:             ['name', 'description', 'special_rule'],
  ref_skills:                 ['label', 'description', 'family'],
  ref_career_random_benefits: ['description'],
  ref_equipment:              ['name', 'description', 'family', 'category'],
}

export const up = async (knex) => {
  for (const [table, fields] of Object.entries(TRANSLATABLE)) {
    const clauses = fields
      .map((f) => `ADD COLUMN IF NOT EXISTS "${f}_i18n" jsonb NOT NULL DEFAULT '{}'::jsonb`)
      .join(', ')
    await knex.raw(`ALTER TABLE "${table}" ${clauses}`)
  }
}

export const down = async (knex) => {
  for (const [table, fields] of Object.entries(TRANSLATABLE)) {
    const clauses = fields.map((f) => `DROP COLUMN IF EXISTS "${f}_i18n"`).join(', ')
    await knex.raw(`ALTER TABLE "${table}" ${clauses}`)
  }
}
