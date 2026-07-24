// Migration 205 — docs/PLAN_WIZARD_MATERIEL.md §5. char_advantage_notes (migration 124) est
// aujourd'hui une seule liste générique de texte libre, partagée par le bloc "Autres" narratif
// d'AdvantagesPanel.jsx. Le nouveau chantier "Matériel & Biens" (Wizard Step6) y ajoute les biens non
// matériels notés par le MJ — sans distinction, les deux se mélangeraient dans la même liste, aux deux
// endroits (fiche permanente et Wizard). Colonne discriminante (patron standard, pas une table
// dupliquée pour la même structure) : 'narrative' (comportement existant, valeur par défaut, migration
// transparente pour les lignes déjà en base) ou 'possession' (nouveau).

export const up = async (knex) => {
  await knex.schema.alterTable('char_advantage_notes', (table) => {
    table.text('category').notNullable().defaultTo('narrative')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_advantage_notes', (table) => {
    table.dropColumn('category')
  })
}
