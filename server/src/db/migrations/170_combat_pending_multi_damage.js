// 170_combat_pending_multi_damage.js
// docs/PLAN_COMBAT_ACTION_QUEUE.md §3 — correctif isolé, livré avant docs/PLAN_COMBAT_TIMELINE.md Lot A
// (docs/PLAN_COMBAT_TIMELINE.md §6sexies point 2, §7).
//
// Bug réel, déjà vivant en production : la PK composite (campaign_id, token_id, type) suppose qu'un
// personnage n'a jamais plus d'une entrée 'damage' en attente. Une attaque multiple CaC (CaC 4b)
// touchant deux défenseurs PJ distincts dans la même série insère deux fois type='damage' pour le
// même attaquant → collision PK → la 2e/3e attaque disparaît silencieusement (catch générique du
// handler COMBAT_MELEE_DEFENSE_CONFIRM). melee_defense/stun restent réellement singuliers
// (sub_phase est une valeur unique par campagne, un seul flux d'attente à la fois — vérifié
// PLAN_COMBAT_ACTION_QUEUE.md §0.2), leur contrainte d'unicité est donc conservée, seule celle de
// 'damage' est retirée.

export const up = async (knex) => {
  await knex.schema.alterTable('combat_pending', (table) => {
    table.uuid('id').notNullable().defaultTo(knex.raw('gen_random_uuid()'))
  })
  await knex.raw('ALTER TABLE combat_pending DROP CONSTRAINT combat_pending_pkey')
  await knex.raw('ALTER TABLE combat_pending ADD CONSTRAINT combat_pending_pkey PRIMARY KEY (id)')
  // Index unique partiel — melee_defense/stun restent singuliers par (campaign_id, token_id, type),
  // 'damage' seul en est désormais exempté (plusieurs lignes possibles, consommées FIFO).
  await knex.raw(`
    CREATE UNIQUE INDEX combat_pending_unique_non_damage
      ON combat_pending (campaign_id, token_id, type)
      WHERE type <> 'damage'
  `)
  // Lecture FIFO (plus ancienne entrée 'damage' d'abord) — COMBAT_DAMAGE_CONFIRM.
  await knex.schema.alterTable('combat_pending', (table) => {
    table.index(['campaign_id', 'token_id', 'type', 'created_at'], 'combat_pending_fifo_idx')
  })
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS combat_pending_fifo_idx')
  await knex.raw('DROP INDEX IF EXISTS combat_pending_unique_non_damage')
  // Dédoublonnage défensif — le nouveau schéma autorise plusieurs lignes 'damage' par
  // (campaign_id, token_id) ; restaurer l'ancienne PK composite exige d'en garder au plus une
  // (la plus récente conservée, arbitraire mais sans conséquence : combat_pending est une file
  // d'attente éphémère, jamais une donnée durable à préserver au rollback).
  await knex.raw(`
    DELETE FROM combat_pending a USING combat_pending b
    WHERE a.campaign_id = b.campaign_id AND a.token_id = b.token_id AND a.type = b.type
      AND a.type = 'damage' AND a.created_at < b.created_at
  `)
  await knex.raw('ALTER TABLE combat_pending DROP CONSTRAINT combat_pending_pkey')
  await knex.schema.alterTable('combat_pending', (table) => {
    table.dropColumn('id')
  })
  await knex.raw('ALTER TABLE combat_pending ADD CONSTRAINT combat_pending_pkey PRIMARY KEY (campaign_id, token_id, type)')
}
