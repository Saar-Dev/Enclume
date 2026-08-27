// 317_combat_action_targets.js — docs/PLANS/PLAN_AOE.md §3
//
// Table additive : combat_actions.target_token_id reste une colonne scalaire pour les actions cible
// unique existantes (jamais retouchée). Une action AOE (grenade, fusil à pompe, tir de suppression,
// pouvoir à zone) laisse target_token_id à NULL et peuple cette table à la place — une ligne par
// cible touchée par la zone d'effet.
//
// Écrite intégralement à la phase RÉSOLUTION (jamais à l'ANNONCE, PLAN_AOE.md §3) : distance_m,
// has_line_of_sight et damage_modifier sont connus dès l'insertion (calculés depuis la position
// réelle au moment de la résolution, couches 2/3/4). outcome reste NULL jusqu'à la confirmation de
// dégât de cette cible précise (PNJ immédiat ou PJ différé, §5.1) — appliqué via une mise à jour
// conditionnelle `WHERE outcome IS NULL` pour l'idempotence (§3), jamais une deuxième écriture ici.
//
// target_token_id/target_entity_id : ON DELETE SET NULL, aligné sur le précédent déjà en base
// (combat_actions.target_token_id, 224_combat_actions_foreign_keys.js) — la ligne doit survivre à la
// suppression d'un token/entité en cours de résolution (historique de résolution, pas un pointeur
// vif), pas de politique différente inventée pour une nouvelle table. target_entity_id est
// fonctionnellement hors scope v1 (entités libres non ciblables par une AOE, PLAN_AOE.md §10) mais la
// colonne existe dès maintenant pour éviter une 2ᵉ migration le jour où ce scope s'ouvre.
export const up = async (knex) => {
  await knex.schema.createTable('combat_action_targets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('action_id').notNullable()
    t.uuid('target_token_id')
    t.uuid('target_entity_id')
    t.decimal('distance_m', 12, 4).notNullable()
    t.boolean('has_line_of_sight').notNullable()
    t.jsonb('damage_modifier').notNullable()
    t.jsonb('outcome')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw(`
    ALTER TABLE combat_action_targets
      ADD CONSTRAINT combat_action_targets_action_id_foreign
      FOREIGN KEY (action_id) REFERENCES combat_actions(id) ON DELETE CASCADE
  `)
  await knex.raw(`
    ALTER TABLE combat_action_targets
      ADD CONSTRAINT combat_action_targets_target_token_id_foreign
      FOREIGN KEY (target_token_id) REFERENCES tokens(id) ON DELETE SET NULL
  `)
  await knex.raw(`
    ALTER TABLE combat_action_targets
      ADD CONSTRAINT combat_action_targets_target_entity_id_foreign
      FOREIGN KEY (target_entity_id) REFERENCES entities(id) ON DELETE SET NULL
  `)
  // Au plus une des deux cibles renseignée — jamais token ET entité sur la même ligne (même esprit que
  // chk_weapon_xor sur combat_actions, 316_combat_actions_exo_weapon.js).
  await knex.raw(`
    ALTER TABLE combat_action_targets
      ADD CONSTRAINT chk_combat_action_targets_target_xor CHECK (
        (target_token_id IS NOT NULL)::int + (target_entity_id IS NOT NULL)::int <= 1
      )
  `)
  await knex.raw(`
    CREATE INDEX combat_action_targets_action_id_idx ON combat_action_targets (action_id)
  `)
}

export const down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS combat_action_targets CASCADE`)
}
