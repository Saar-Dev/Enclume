// Migration 162 — char_inventory_slots : table d'intersection remplaçant à terme
// char_inventory.slot (chaîne délimitée par '/'). Corrige l'anti-pattern "Jaywalking"
// (Karwin, SQL Antipatterns) trouvé en simulant l'équipement d'un bouclier — voir
// docs/PLAN_INVENTORY_SLOTS.md. Lot A : fondation (nouvelle table, aucun lecteur basculé) —
// char_inventory.slot reste l'autorité tant que le Lot B n'a pas basculé tous les lecteurs.
export const up = async (knex) => {
  await knex.schema.createTable('char_inventory_slots', (table) => {
    table.uuid('char_inventory_id').notNullable()
      .references('id').inTable('char_inventory').onDelete('CASCADE')
    table.uuid('character_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.string('slot_code', 10).notNullable()
    table.primary(['char_inventory_id', 'slot_code'])
  })

  await knex.raw(`
    ALTER TABLE char_inventory_slots
      ADD CONSTRAINT chk_inventory_slots_code
      CHECK (slot_code IN ('T','C','BG','BD','JG','JD','D','Ce','MG','MD','2M','Tr'))
  `)

  // Un seul occupant pour les slots main/contenant — jamais de layering possible ici, contrairement
  // aux slots armure qui tolèrent jusqu'à 3 couches (règle 1+S+S, reste applicative : un simple
  // COUNT/CHECK déclaratif ne peut pas exprimer "au plus 1 non-S + 2 S").
  await knex.raw(`
    CREATE UNIQUE INDEX uq_inventory_slots_hand_container
      ON char_inventory_slots (character_id, slot_code)
      WHERE slot_code IN ('MG','MD','2M','Tr','D','Ce')
  `)

  // Index simple (non unique) pour les lectures fréquentes en combat (armuresCible, un lookup par
  // coup résolu) — les slots armure n'ont pas de contrainte d'unicité mais doivent rester rapides.
  await knex.raw(`
    CREATE INDEX idx_inventory_slots_character_slot
      ON char_inventory_slots (character_id, slot_code)
  `)

  // Rétro-remplissage : chaque char_inventory.slot existant ("BG/C", "MG", etc.) éclaté en une ligne
  // par code — set-based (unnest/string_to_array), pas de boucle applicative.
  await knex.raw(`
    INSERT INTO char_inventory_slots (char_inventory_id, character_id, slot_code)
    SELECT ci.id, ci.character_id, unnest(string_to_array(ci.slot, '/'))
    FROM char_inventory ci
    WHERE ci.slot IS NOT NULL
  `)

  // Vérification round-trip : l'ensemble des codes rétro-remplis doit correspondre exactement à
  // l'ensemble des codes de l'ancienne colonne pour 100% des lignes — pas un simple comptage global.
  // Échec = abandon de la migration plutôt qu'un commit silencieux de données incohérentes.
  const { rows: [{ mismatched }] } = await knex.raw(`
    WITH old_sets AS (
      SELECT ci.id AS char_inventory_id,
             (SELECT array_agg(DISTINCT s::text ORDER BY s::text) FROM unnest(string_to_array(ci.slot, '/')) AS s) AS codes
      FROM char_inventory ci
      WHERE ci.slot IS NOT NULL
    ),
    new_sets AS (
      SELECT char_inventory_id, array_agg(DISTINCT slot_code::text ORDER BY slot_code::text) AS codes
      FROM char_inventory_slots
      GROUP BY char_inventory_id
    )
    SELECT count(*) AS mismatched
    FROM old_sets o
    LEFT JOIN new_sets n USING (char_inventory_id)
    WHERE o.codes IS DISTINCT FROM n.codes
  `)
  if (Number(mismatched) > 0) {
    throw new Error(`Migration 162 — rétro-remplissage incohérent pour ${mismatched} item(s), abandon`)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTable('char_inventory_slots')
}
