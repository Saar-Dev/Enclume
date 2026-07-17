// 168_ref_equipment_bouclier.js
// docs/PLAN_BOUCLIER.md Lot A — catalogue des 3 boucliers RAW (docs/REGLES/REGLEBOUCLIER.md).
//
// Correction en session : ce plan affirmait à tort "jamais seedée en base" pour la catégorie
// Bouclier. Vérifié en réalité (pas en lecture seule — un premier essai d'INSERT direct a créé des
// doublons, détecté immédiatement) : 3 lignes existent déjà (créées 2026-05-06, import historique
// docs/Old/script Extraction Excel/equipement/ref_equipments_data.js jamais tracké en migration),
// et l'une d'elles (Bouclier - Moyen) est référencée par l'inventaire d'un personnage réel. Cette
// migration met donc ces 3 lignes À JOUR en place (même patron que 142_ref_equipment_lunette_niveaux.js
// pour une ligne générique enrichie mécaniquement), jamais un nouvel INSERT — préserve l'id et donc
// toute FK char_inventory.equipment_id existante.
//
// 2 colonnes neuves, spécifiques au bouclier (pas de sens pour une arme/armure ordinaire) :
//   - shield_atk_malus       : malus au Test d'attaque de l'ADVERSAIRE au contact (-3/-5/-7).
//   - shield_extra_locations : localisations supplémentaires ('/'-jointes, codes ARMOR_SLOTS)
//     couvertes en plus du bras portant le bouclier (déduit à l'équipement via HAND_TO_ARM_SLOT,
//     shared/armorConstants.js) — fixé au catalogue, jamais un choix joueur (docs/PLAN_BOUCLIER.md §3.5).
// `protection` (colonne existante, déjà correcte : 15/10/10) réutilisé tel quel pour la protection à
// distance — même mécanique que n'importe quelle armure, aucune nouvelle colonne nécessaire.
// `location` : 'B' (bras, valeur d'origine) → 'M' (main, comme les armes) — le bouclier occupe
// fondamentalement une main ; le distingue du brassard/armure au moment où location est consultée
// (isEquippableLocation, P58 dans updateItem), la couverture corporelle passe uniquement par
// shield_extra_locations, jamais par location.
// Prix/poids/rareté/tech_level/min_str/description : valeurs d'origine déjà exactes (identiques à la
// source historique), non retouchées.

const ROWS = [
  { name: 'Bouclier - Petit', shield_atk_malus: -3, shield_extra_locations: null },
  { name: 'Bouclier - Moyen', shield_atk_malus: -5, shield_extra_locations: 'C' },
  { name: 'Bouclier - Grand', shield_atk_malus: -7, shield_extra_locations: 'C/T' },
]

export const up = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.integer('shield_atk_malus').nullable()
    table.text('shield_extra_locations').nullable()
  })

  await knex.raw(`
    ALTER TABLE ref_equipment
      ADD CONSTRAINT chk_eq_shield_atk_malus CHECK (shield_atk_malus IS NULL OR shield_atk_malus < 0),
      ADD CONSTRAINT chk_eq_shield_extra_locations CHECK (shield_extra_locations IS NULL OR shield_extra_locations IN ('C', 'C/T'))
  `)

  for (const row of ROWS) {
    const updated = await knex('ref_equipment')
      .where({ category: 'Bouclier', name: row.name })
      .update({
        location: 'M',
        shield_atk_malus: row.shield_atk_malus,
        shield_extra_locations: row.shield_extra_locations,
        updated_at: knex.fn.now(),
      })
    if (updated !== 1) {
      throw new Error(`Migration 168 — "${row.name}" : ${updated} ligne(s) trouvée(s), attendu exactement 1`)
    }
  }
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .where({ category: 'Bouclier' })
    .update({
      location: 'B',
      shield_atk_malus: null,
      shield_extra_locations: null,
      updated_at: knex.fn.now(),
    })

  await knex.raw(`
    ALTER TABLE ref_equipment
      DROP CONSTRAINT IF EXISTS chk_eq_shield_atk_malus,
      DROP CONSTRAINT IF EXISTS chk_eq_shield_extra_locations
  `)

  await knex.schema.alterTable('ref_equipment', (table) => {
    table.dropColumn('shield_atk_malus')
    table.dropColumn('shield_extra_locations')
  })
}
