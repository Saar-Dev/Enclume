// 237_char_archetype_base_age.js
// Bug #5/#15 (docs/BUG WIZARD.md) — char_archetype.age stocke l'âge FINAL (baseAge + années
// d'études + années de carrière), écrit par reconcileCreation STEP4. getStep4State renvoyait ce
// même champ comme âge de base au client (Step4Experience.jsx réutilise initialData.age comme
// point de départ), provoquant un cumul à chaque réhydratation (reload, ou l'auto-écho
// WIZARD_STATE_SYNC identifié au bug #3). base_age stocke l'âge de base soumis par le joueur,
// distinct de age (qui reste l'âge courant du personnage, utilisé hors Wizard — char-sheet.js).

export const up = async (knex) => {
  await knex.schema.alterTable('char_archetype', (table) => {
    table.integer('base_age').defaultTo(null)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_archetype', (table) => {
    table.dropColumn('base_age')
  })
}
