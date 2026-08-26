// 316_combat_actions_exo_weapon.js — PLAN_EXOARMURE.md §16.4
//
// Colonne additive, mirroir exact de drone_weapon_inv_id (30_combat_actions.js:24,
// 224_combat_actions_foreign_keys.js) : une exo-armure cherche son arme dans exo_weapons, jamais
// char_inventory (mauvais inventaire) ni drone_weapons (Seuil à plat, non RAW pour une exo — §16.4).
//
// chk_weapon_xor (127_combat_actions_constraints.js) est une contrainte déjà appliquée sur cette base
// — jamais éditer ce fichier après coup (CLAUDE.md §5, précédent vécu : migration 233 éditée après
// avoir déjà tourné, "column already exists" au migrate.latest() suivant, ticket bug_tickets
// 221f493a). On la remplace ici par une version à 3 voies : au plus une des 3 colonnes armes est
// renseignée (0 ou 1, jamais 2+) — plus lisible en comptage qu'en OR par paires.
export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (t) => {
    t.uuid('exo_weapon_inv_id')
  })
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT combat_actions_exo_weapon_inv_id_foreign
      FOREIGN KEY (exo_weapon_inv_id) REFERENCES exo_weapons(id) ON DELETE SET NULL
  `)
  await knex.raw(`ALTER TABLE combat_actions DROP CONSTRAINT chk_weapon_xor`)
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT chk_weapon_xor CHECK (
        (weapon_inv_id IS NOT NULL)::int
        + (drone_weapon_inv_id IS NOT NULL)::int
        + (exo_weapon_inv_id IS NOT NULL)::int
        <= 1
      )
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE combat_actions DROP CONSTRAINT chk_weapon_xor`)
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT chk_weapon_xor CHECK ((weapon_inv_id IS NULL) OR (drone_weapon_inv_id IS NULL))
  `)
  await knex.raw(`ALTER TABLE combat_actions DROP CONSTRAINT IF EXISTS combat_actions_exo_weapon_inv_id_foreign`)
  await knex.schema.alterTable('combat_actions', (t) => {
    t.dropColumn('exo_weapon_inv_id')
  })
}
