/**
 * Migration 257 — Systèmes / Armement / Ordinateur exo-armure (Lot C, PLAN_EXOARMURE.md §13.4)
 *
 * Schéma seul — aucune donnée (le seed des ~200-300 lignes transcrites depuis `docs/REGLES/SEEDEXO.md`
 * est une migration séparée, §13.4.4, même discipline que 251/252/253). Deux familles de tables :
 *
 * - `exo_systems`/`exo_weapons`/`exo_programs`/`exo_computers` (instance, character_id-keyed) — mirror
 *   `drone_weapons`/`drone_programs` (71_drone_sheet.js + 76c/137b), avec Intégrité par ligne
 *   (`integrite_max`/`integrite_current`), absente du patron drone (celui-ci ne track l'Intégrité
 *   qu'au niveau du drone entier).
 * - `ref_exo_template_equipment`/`ref_exo_template_computers` (catalogue, template_id-keyed,
 *   ON DELETE CASCADE) — loadout d'usine par modèle (§13.4.4, tranché par Saar 2026-08-20 :
 *   "armement et armes sont des paramètres d'usine. Modifiable mais pré-made"), copié par
 *   `applyExoTemplate` au moment de la sélection, jamais une dépendance live relue en combat.
 *
 * `exo_computers`/`ref_exo_template_computers` existent en tables séparées plutôt qu'en colonnes
 * scalaires sur `exo_sheet`/`ref_exo_templates` (première rédaction du 2026-08-20, invalidée le
 * 2026-08-21) : vérification ligne à ligne de `SEEDEXO.md` — 4 armures sur 16 (Nymph 1-A,
 * Heimdall-Pyrelia, Odin, Moloch) ont un ordinateur "principal" ET un ordinateur "secours" distincts,
 * chacun avec son propre NT/Gén. Un ordinateur est un système à cardinalité variable (0/1/2 par
 * armure), pas une stat de base à cardinalité fixe comme EXF/Blindage — même famille de besoin que
 * les 4 autres tables de ce fichier, `role` distingue les deux exemplaires possibles (jamais plus,
 * RAW : "jamais deux systèmes identiques à la fois", `SEEDEXO.md:22-24`).
 *
 * CHECK en base pour l'exclusivité `equipment_id`/`label_override` sur les 3 tables catalogue+custom
 * (`exo_systems`/`exo_weapons`/`exo_programs`/`ref_exo_template_equipment`) — discipline retenue
 * explicitement (PLAN_EXOARMURE.md §13.4.2) plutôt qu'un mirror aveugle de l'incohérence drone
 * (`drone_programs` a ce CHECK depuis 137b, `drone_weapons` ne l'a jamais eu, seulement côté route).
 *
 * Retire `exo_sheet.equipped_systems`/`hardpoints`/`isolated_systems`/`damaged_systems` (Lot 1,
 * jamais peuplées par aucun code de production hors `vaultService.js#cloneExoSheet` — voir le fichier
 * séparé qui corrige cet appelant dans le même commit, PLAN_EXOARMURE.md §13.4.3).
 */

const ROLE_VALUES = ['principal', 'secours']
const TEMPLATE_EQUIPMENT_FAMILY_VALUES = ['arme', 'systeme']

export const up = async (knex) => {
  // ─── Instance — character_id-keyed, mirror drone_weapons/drone_programs ──────────────────────
  await knex.schema.createTable('exo_systems', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('character_id').notNullable().references('id').inTable('characters').onDelete('CASCADE')
    t.uuid('equipment_id').references('id').inTable('ref_exo_equipment').onDelete('RESTRICT')
    t.text('label_override')
    t.integer('level')
    t.integer('integrite_max')
    t.integer('integrite_current')
    t.smallint('sort_order').notNullable().defaultTo(0)
  })

  await knex.schema.createTable('exo_weapons', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('character_id').notNullable().references('id').inTable('characters').onDelete('CASCADE')
    t.uuid('equipment_id').references('id').inTable('ref_exo_equipment').onDelete('RESTRICT')
    t.text('label_override')
    t.integer('integrite_max')
    t.integer('integrite_current')
    t.smallint('sort_order').notNullable().defaultTo(0)
  })

  await knex.schema.createTable('exo_programs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('character_id').notNullable().references('id').inTable('characters').onDelete('CASCADE')
    t.uuid('equipment_id').references('id').inTable('ref_equipment').onDelete('RESTRICT')
    t.text('label_override')
    t.text('category').notNullable()
    t.integer('level').notNullable().checkBetween([0, 30])
    t.smallint('sort_order').notNullable().defaultTo(0)
  })

  await knex.schema.createTable('exo_computers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('character_id').notNullable().references('id').inTable('characters').onDelete('CASCADE')
    t.text('role').notNullable()
    t.smallint('gen').notNullable()
    t.smallint('nt').notNullable()
    t.integer('blindage_iem')
    t.integer('integrite_max')
    t.integer('integrite_current')
    t.smallint('sort_order').notNullable().defaultTo(0)
  })

  // ─── Catalogue — loadout d'usine par modèle, template_id-keyed ────────────────────────────────
  await knex.schema.createTable('ref_exo_template_equipment', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('template_id').notNullable().references('id').inTable('ref_exo_templates').onDelete('CASCADE')
    t.text('family').notNullable()
    t.uuid('equipment_id').references('id').inTable('ref_exo_equipment').onDelete('RESTRICT')
    t.text('label_override')
    t.integer('level')
    t.smallint('sort_order').notNullable().defaultTo(0)
  })

  await knex.schema.createTable('ref_exo_template_computers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('template_id').notNullable().references('id').inTable('ref_exo_templates').onDelete('CASCADE')
    t.text('role').notNullable()
    t.smallint('gen').notNullable()
    t.smallint('nt').notNullable()
    t.smallint('sort_order').notNullable().defaultTo(0)
  })

  await knex.raw(`
    ALTER TABLE exo_systems
      ADD CONSTRAINT chk_exo_systems_source CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL);
    ALTER TABLE exo_weapons
      ADD CONSTRAINT chk_exo_weapons_source CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL);
    ALTER TABLE exo_programs
      ADD CONSTRAINT chk_exo_programs_source CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL);
    ALTER TABLE exo_computers
      ADD CONSTRAINT chk_exo_computers_role CHECK (role IN (${ROLE_VALUES.map(v => `'${v}'`).join(', ')}));
    ALTER TABLE ref_exo_template_equipment
      ADD CONSTRAINT chk_exo_template_equipment_source CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL),
      ADD CONSTRAINT chk_exo_template_equipment_family CHECK (family IN (${TEMPLATE_EQUIPMENT_FAMILY_VALUES.map(v => `'${v}'`).join(', ')}));
    ALTER TABLE ref_exo_template_computers
      ADD CONSTRAINT chk_exo_template_computers_role CHECK (role IN (${ROLE_VALUES.map(v => `'${v}'`).join(', ')}));
  `)

  // ─── exo_sheet — retrait des 4 colonnes jsonb jamais peuplées par aucun code de production
  // (hors vaultService.js#cloneExoSheet, corrigé dans le même commit) ────────────────────────────
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.dropColumn('equipped_systems')
    t.dropColumn('hardpoints')
    t.dropColumn('isolated_systems')
    t.dropColumn('damaged_systems')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.jsonb('equipped_systems').notNullable().defaultTo('[]')
    t.jsonb('hardpoints').notNullable().defaultTo('{}')
    t.jsonb('isolated_systems').notNullable().defaultTo('[]')
    t.jsonb('damaged_systems').notNullable().defaultTo('{}')
  })

  await knex.schema.dropTableIfExists('ref_exo_template_computers')
  await knex.schema.dropTableIfExists('ref_exo_template_equipment')
  await knex.schema.dropTableIfExists('exo_computers')
  await knex.schema.dropTableIfExists('exo_programs')
  await knex.schema.dropTableIfExists('exo_weapons')
  await knex.schema.dropTableIfExists('exo_systems')
}
