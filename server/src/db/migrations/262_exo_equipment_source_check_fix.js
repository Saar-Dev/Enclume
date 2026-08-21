/**
 * Migration 262 — corrige le CHECK exclusive arc de la migration 260 (PLAN_EXOARMURE.md §13.4.4 suite)
 *
 * Trouvé en relecture critique avant de démarrer la transcription des 16 loadouts (Saar a demandé une
 * analyse à charge du travail déjà fait, pas seulement du travail à venir) : la migration 260 impose
 * un exclusive arc strict — exactement une des 3 branches (`equipment_id`/`ref_equipment_id`/
 * `label_override`), jamais deux — correct pour "quelle est la source de cette ligne", mais le plan de
 * transcription s'appuie sur un usage différent découvert *après* 260 : `label_override` comme
 * **annotation** posée à côté d'une vraie source catalogue (ex. "SACEA (secours)" = `equipment_id`
 * vers SACEA + `label_override` pour distinguer principal/secours, faute de colonne `role` sur cette
 * table — contrairement à `exo_computers`/`ref_exo_template_computers` qui en ont une, migration 257).
 * Le CHECK de 260 rejette ce cas — vérifié concrètement contre PostgreSQL réel avant d'écrire cette
 * migration (pas supposé), 260 a même un test qui *garantit* ce rejet
 * (`260_exo_equipment_dual_catalog.test.mjs`, "refuse : equipment_id + label_override").
 *
 * Nouveau CHECK : jamais les deux vraies sources catalogue à la fois (`equipment_id` ET
 * `ref_equipment_id`), mais `label_override` peut coexister avec l'une des deux comme note d'affichage
 * — et au moins un des trois champs doit être renseigné (source ou label custom seul). Migration
 * distincte de 260 (jamais retouchée une fois appliquée, CLAUDE.md §5), pas une correction en place.
 */

const ALTERED_TABLES = ['exo_systems', 'exo_weapons', 'ref_exo_template_equipment']

const CHECK_NAMES = {
  exo_systems: 'chk_exo_systems_source',
  exo_weapons: 'chk_exo_weapons_source',
  ref_exo_template_equipment: 'chk_exo_template_equipment_source',
}

export const up = async (knex) => {
  for (const table of ALTERED_TABLES) {
    const check = CHECK_NAMES[table]
    await knex.raw(`
      ALTER TABLE ${table}
        DROP CONSTRAINT ${check},
        ADD CONSTRAINT ${check} CHECK (
          NOT (equipment_id IS NOT NULL AND ref_equipment_id IS NOT NULL)
          AND (equipment_id IS NOT NULL OR ref_equipment_id IS NOT NULL OR label_override IS NOT NULL)
        );
    `)
  }
}

export const down = async (knex) => {
  for (const table of ALTERED_TABLES) {
    const check = CHECK_NAMES[table]
    await knex.raw(`
      ALTER TABLE ${table}
        DROP CONSTRAINT ${check},
        ADD CONSTRAINT ${check} CHECK (
          (equipment_id IS NOT NULL)::int
          + (ref_equipment_id IS NOT NULL)::int
          + (label_override IS NOT NULL)::int
          = 1
        );
    `)
  }
}
