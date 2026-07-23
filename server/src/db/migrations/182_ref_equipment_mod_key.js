// Migration 182 — ref_equipment.mod_key (docs/PLAN_MODDING_REFONTE.md Phase 1, Étape 1.6)
//
// Route un mod installé vers son handler dans shared/weaponModRegistry.js sans jamais lister
// d'equipment_id en dur dans un fichier JS (précédent PF2e Rule Elements : le type de comportement
// est une donnée sur l'item catalogue, pas une liste d'ID en code — voir plan). Colonne seule ici,
// aucune population : chaque phase consommatrice (4.1.1/4.2.1/4.3.1 pour Groupe 4 ; 2.1 pour
// Groupe 1/2, différée) peuple ses propres valeurs quand elle câble réellement son handler.
export const up = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.text('mod_key').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.dropColumn('mod_key')
  })
}
