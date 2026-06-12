/**
 * Migration 76d — Split catégorie 'armement' en 'armement_distance' / 'armement_contact'
 *
 * Sprint 2c : resolveDroneAssaultAction cherche WHERE category = 'armement_distance'
 * ou 'armement_contact' selon drone_weapons.fire_mode. La valeur 'armement' générique
 * retournerait 0 résultats → toutes les attaques drones ratées silencieusement.
 *
 * Décision : tous les programmes 'armement' existants → 'armement_distance' par défaut.
 * Pour un drone CaC, le GM crée manuellement un programme avec category='armement_contact'.
 */

export const up = async (knex) => {
  // Catalogue : ref_equipment family='Logiciels'
  await knex('ref_equipment')
    .where({ family: 'Logiciels', category: 'armement' })
    .update({ category: 'armement_distance' })

  // Instances drone_programs existantes
  await knex('drone_programs')
    .where({ category: 'armement' })
    .update({ category: 'armement_distance' })
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .where({ family: 'Logiciels', category: 'armement_distance' })
    .update({ category: 'armement' })

  await knex('drone_programs')
    .where({ category: 'armement_distance' })
    .update({ category: 'armement' })
}
