// 130_vault_transfer_requests.js
// PLAN_VAULT.md Étape 2 — demandes de transfert Vault → campagne (Décision 3 : "vers une campagne"
// exige (a) appartenance à la campagne cible ET (b) validation du MJ — voir Piège P2, revalidé à
// l'approbation, pas seulement à la création de la requête).
//
// Écarts volontaires par rapport au schéma esquissé dans PLAN_VAULT.md (mêmes clés/colonnes, FK
// affinées) :
//  - `requested_by`/`reviewed_by` : "qui a fait l'action" (piste d'audit), pas "à qui appartient la
//    ligne" (ce rôle est déjà tenu par vault_character_id/target_campaign_id) — ON DELETE SET NULL,
//    même logique que characters.user_id (migration 15) plutôt qu'un CASCADE qui effacerait
//    l'historique si un compte est supprimé.
//  - `created_character_id` : ON DELETE SET NULL explicite (le clone créé peut être supprimé plus
//    tard sans effacer la trace de la demande d'origine).
//  - Index unique partiel : au plus une demande 'pending' par (personnage Vault, campagne cible) —
//    évite le spam de demandes en double, même pattern que uq_char_mut_no_sub (migration 96).

export const up = async (knex) => {
  await knex.schema.createTable('vault_transfer_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('vault_character_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.uuid('target_campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('requested_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    table.text('status').notNullable().defaultTo('pending')
    table.uuid('reviewed_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('reviewed_at', { useTz: true }).nullable()
    table.uuid('created_character_id').nullable()
      .references('id').inTable('characters').onDelete('SET NULL')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw(`
    ALTER TABLE vault_transfer_requests
    ADD CONSTRAINT chk_vault_transfer_requests_status
    CHECK (status IN ('pending', 'approved', 'rejected'))
  `)

  await knex.raw(`
    CREATE UNIQUE INDEX uq_vault_transfer_pending
      ON vault_transfer_requests (vault_character_id, target_campaign_id)
      WHERE status = 'pending'
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('vault_transfer_requests')
}
