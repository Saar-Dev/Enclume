// token_statuses.data — charge de données par instance pour un statut (docs/PLAN_FATIGUE_DOMMAGES.md
// §9 Lot 3, point ouvert 2). Additive, nullable : les statuts existants (ATI/mods, stun/unconscious)
// continuent avec data NULL implicite. Sert d'abord aux dangers environnementaux (Acide/Décompression/
// Feu, increment F) pour stocker leur formule de dégâts et leur nombre de localisations par instance —
// l'intensité vit dans data, jamais dans status_code (deux Feux peuvent partager le même code avec des
// data différentes). Même patron que char_inventory_mods.state (migration 180_char_inventory_mods_state.js).
export const up = async (knex) => {
  await knex.schema.alterTable('token_statuses', (table) => {
    table.jsonb('data').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('token_statuses', (table) => {
    table.dropColumn('data')
  })
}
