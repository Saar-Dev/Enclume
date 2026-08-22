/**
 * DRAFT — Phase 1 PLAN_MIGRATIONS_REFONTE — effets collatéraux des migrations archivées
 *
 * 3 des 18 migrations archivées (48, 53, 73, 75, 76d, 83, 87, 135, 141, 142, 160, 168, 178, 182,
 * 184, 190, 209, 235) modifiaient aussi des tables HORS cluster ref_equipment*, en plus de leur
 * partie catalogue (déjà couverte par 48_ref_equipment.js / 48b_ref_equipment_data.js). Retiré du
 * schéma/données ref_equipment lui-même pour garder ces 2 fichiers strictement au périmètre des
 * 4 tables — trouvé par diff structurel complet (migra, base rejouée vs vtt) après un premier
 * essai qui les avait silencieusement perdus en archivant les 18 fichiers.
 *
 * - 73_drone_programs_catalog.js  → ALTER drone_programs (catalogue logiciels drone : la partie
 *   INSERT ref_equipment de cette même migration est already capturée par 48b, pas rejouée ici).
 * - 141_ref_equipment_mod_slots.js → ALTER char_inventory_mods + backfill (mods déjà installés).
 * - 190_choc1_palier1_shock_mechanism.js → ALTER ref_mutations + backfill (mutation Corne).
 *
 * Colonnes/contraintes exactes vérifiées par diff structurel (migra) contre vtt, pas retapées à
 * la main depuis l'historique des 3 migrations sources.
 */

export const up = async (knex) => {
  // ─── drone_programs (ex-migration 73) ───────────────────────────────────────
  await knex.raw(`
    ALTER TABLE drone_programs
      DROP COLUMN label,
      ADD COLUMN equipment_id UUID REFERENCES ref_equipment(id) ON DELETE RESTRICT,
      ADD COLUMN label_override TEXT,
      ADD COLUMN category TEXT NOT NULL DEFAULT 'specialise',
      ADD CONSTRAINT chk_dp_source
        CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL)
  `)
  await knex.raw(`ALTER TABLE drone_programs ALTER COLUMN category DROP DEFAULT`)

  // ─── char_inventory_mods (ex-migration 141) ─────────────────────────────────
  await knex.schema.alterTable('char_inventory_mods', (table) => {
    table.text('mod_slot').nullable()
  })
  // Backfill des mods déjà installés (character data, pas du catalogue) : sans ça le garde-fou
  // d'exclusivité ne verrait pas un mod existant lors d'un swap futur.
  await knex.raw(`
    UPDATE char_inventory_mods
    SET mod_slot = ref_equipment.mod_slot
    FROM ref_equipment
    WHERE char_inventory_mods.equipment_id = ref_equipment.id
  `)
  await knex.raw(`
    CREATE UNIQUE INDEX uq_char_inv_mods_slot
      ON char_inventory_mods (weapon_inv_id, mod_slot)
      WHERE mod_slot IS NOT NULL
  `)

  // ─── ref_mutations (ex-migration 190) ───────────────────────────────────────
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.string('natural_weapon_choc_formula', 20).nullable()
  })
  const countCorne = await knex('ref_mutations').where({ name: 'Corne' })
    .update({ natural_weapon_choc_formula: '1D6' })
  if (countCorne !== 1) {
    throw new Error(`48c_ref_equipment_archive_side_effects — mutation Corne introuvable (${countCorne} ligne mise à jour)`)
  }
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.dropColumn('natural_weapon_choc_formula')
  })
  await knex.raw('DROP INDEX IF EXISTS uq_char_inv_mods_slot')
  await knex.schema.alterTable('char_inventory_mods', (table) => {
    table.dropColumn('mod_slot')
  })
  await knex.raw(`
    ALTER TABLE drone_programs
      DROP CONSTRAINT IF EXISTS chk_dp_source,
      DROP COLUMN IF EXISTS equipment_id,
      DROP COLUMN IF EXISTS label_override,
      DROP COLUMN IF EXISTS category,
      ADD COLUMN label TEXT NOT NULL DEFAULT ''
  `)
  await knex.raw(`ALTER TABLE drone_programs ALTER COLUMN label DROP DEFAULT`)
}
