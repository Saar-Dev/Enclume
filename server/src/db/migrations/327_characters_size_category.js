// 327_characters_size_category.js — docs/PLANS/PLAN_TAILLE.md S2
//
// Palier de taille explicite d'un personnage : les 8 valeurs RAW « Taille de la cible »
// (LdB p.218 — énumération SIZE_CATEGORIES de shared/sizeCategory.js, recopiée ici car une
// migration est un instantané figé). NULL = « dériver » (défaut universel) : la taille se
// calcule alors depuis les dimensions de la fiche (char_identity.height / drone_sheet.taille /
// exo_sheet.category) via resolveSizeCategoryFrom. Quand la colonne est renseignée, elle est
// AUTORITAIRE quel que soit le type de corps — c'est ainsi qu'un PNJ colossal ou un drone RAW
// « cible de petite taille (-3) » reçoit sa taille sans dépendre d'un centimétrage saisi.
//
// Rétrocompatible : colonne nullable additive, aucun code déployé ne la lit encore
// (branchement combat = S3, UI = S4/S5).

const SIZE_CATEGORIES = [
  'minuscule', 'tres_petite', 'petite', 'moyenne',
  'grande', 'tres_grande', 'enorme', 'gigantesque',
]

export const up = async (knex) => {
  await knex.schema.alterTable('characters', (t) => {
    t.text('size_category')
  })
  await knex.raw(`
    ALTER TABLE characters
      ADD CONSTRAINT chk_characters_size_category
      CHECK (size_category IS NULL OR size_category IN (${SIZE_CATEGORIES.map(v => `'${v}'`).join(', ')}))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE characters DROP CONSTRAINT IF EXISTS chk_characters_size_category')
  await knex.schema.alterTable('characters', (t) => {
    t.dropColumn('size_category')
  })
}
