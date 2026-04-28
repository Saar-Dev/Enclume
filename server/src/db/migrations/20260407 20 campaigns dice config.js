/**
 * Migration 20 — campaigns : dice_config
 *
 * - Supprime critical_success et critical_fail (colonnes scalaires orphelines, jamais utilisées)
 * - Ajoute dice_config JSONB nullable
 *
 * Structure attendue de dice_config :
 * {
 *   "d20": { "success": { "min": 20, "max": 20 }, "fail": { "min": 1, "max": 1 } },
 *   "d6":  { "success": { "min": 6,  "max": 6  }, "fail": null },
 *   "d100":{ "success": null,                      "fail": { "min": 1, "max": 5 } }
 * }
 *
 * Dés couverts : d4, d6, d8, d10, d12, d20, d100
 * Dé absent de la structure = critiques désactivés sur ce dé
 * success/fail null = ce type de critique désactivé sur ce dé
 * Évaluation serveur : total >= min && total <= max (plage inclusive)
 */

export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('critical_success')
    table.dropColumn('critical_fail')
    table.jsonb('dice_config').nullable().defaultTo(null)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('dice_config')
    // Restauration des colonnes d'origine — types conformes à la migration 07
    table.jsonb('critical_success')
    table.jsonb('critical_fail')
  })
}