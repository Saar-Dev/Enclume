// 241_bug_tickets.js
// PLAN_TICKETS.md Lot 1 — table de tickets (joueur/GM/admin → triage admin), fondation posée sur le
// rôle admin global (migration 240). Patron réutilisé de vault_transfer_requests (migration 130) :
// id gen_random_uuid(), colonnes de provenance ON DELETE SET NULL, CHECK en knex.raw.
//
// Décisions issues de PLAN_TICKETS.md §3.1/§4 (recherche externe citée dans le plan) :
//  - `domain` sans CHECK : la liste des domaines de jeu (Combat, Monde, Personnage...) évolue au
//    fil des chantiers (docs/SYSTEME/INDEX.md) — un CHECK figerait une migration à chaque nouveau
//    domaine. Liste proposée côté client uniquement.
//  - `cluster_label` texte libre, pas de table de référence séparée — décision explicite de Saar
//    ("juste organiser des filtres"), même patron que docs/BUGIDENTIFIE.md ("Cluster A"... jamais
//    une table) et que GitHub Issues (labels texte libres, pas de colonnes figées avec FK).
//  - `status` inclut 'suspended' dès ce lot pour matcher le vocabulaire déjà utilisé par
//    BUGIDENTIFIE.md ("suspendu") — évite une migration corrective au Lot 2 (fusion prévue).
//  - `priority` NULL par défaut : posée par l'admin au triage, jamais par le rapporteur (cohérent
//    avec la phase 1 "Triage" de BUGIDENTIFIE.md et les bonnes pratiques de bug report externes).
//  - `reporter_id` NULL autorisé : réservé à origin='log' (signalement non humain, non construit
//    dans ce lot).

export const up = async (knex) => {
  await knex.schema.createTable('bug_tickets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('reporter_id').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    table.text('origin').notNullable()
    table.text('category').notNullable()
    table.text('domain').nullable()
    table.text('title').notNullable()
    table.text('description').notNullable()
    table.jsonb('context').nullable()
    table.text('status').notNullable().defaultTo('new')
    table.text('priority').nullable()
    table.text('cluster_label').nullable()
    table.text('linked_bug_code').nullable()
    table.text('admin_notes').nullable()
    table.uuid('reviewed_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('reviewed_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw(`
    ALTER TABLE bug_tickets
    ADD CONSTRAINT chk_bug_tickets_origin
    CHECK (origin IN ('player', 'gm', 'admin', 'log'))
  `)

  await knex.raw(`
    ALTER TABLE bug_tickets
    ADD CONSTRAINT chk_bug_tickets_category
    CHECK (category IN ('bug', 'balance', 'suggestion', 'other'))
  `)

  await knex.raw(`
    ALTER TABLE bug_tickets
    ADD CONSTRAINT chk_bug_tickets_status
    CHECK (status IN ('new', 'triaged', 'in_progress', 'suspended', 'resolved', 'wont_fix', 'duplicate'))
  `)

  await knex.raw(`
    ALTER TABLE bug_tickets
    ADD CONSTRAINT chk_bug_tickets_priority
    CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('bug_tickets')
}
