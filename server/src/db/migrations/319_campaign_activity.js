// 319_campaign_activity.js — suivi d'activité de campagne (docs/JOURNAL8.md 2026-09-03, Lot C).
//
// Deux tables append-only, agrégats dérivés par requête (jamais un compteur `total_seconds += x` :
// lost updates en concurrence, pas auditable, pas recalculable). Alimentées par le socket
// (SESSION_JOIN / disconnect pour la présence, COMBAT_START / COMBAT_END pour le combat).
//
// campaign_presence_sessions : une ligne par période de connexion d'un utilisateur à une campagne
// (session de jeu ou wizard de création — `context`). `ended_at` NULL = encore connecté.
// `last_seen_at` est bumpé toutes les 5 min par un heartbeat serveur : si le process meurt sans que
// `disconnect` ne se déclenche, l'agrégat utilise `COALESCE(ended_at, last_seen_at)` et ne perd que
// ~5 min au lieu de compter la session à l'infini. Un sweep au boot ferme les lignes restées
// ouvertes d'avant un crash (un serveur qui démarre n'a aucun socket vivant).
//
// campaign_combat_log : une ligne par combat (COMBAT_START → INSERT, COMBAT_END → UPDATE ended_at).
// Le garde FSM interdit un 2ᵉ COMBAT_START sans END → au plus une ligne ouverte par campagne. Pas de
// sweep : une ligne ouverte contribue 0 s à la durée totale (COALESCE(ended_at, started_at)), et un
// combat repris après un crash se ferme normalement via l'unique ligne ouverte.
//
// FK campaign_id ON DELETE CASCADE : des métriques dérivées n'ont aucun sens sans leur campagne.
// FK user_id ON DELETE CASCADE : idem sans l'utilisateur. FK battlemap_id ON DELETE SET NULL : la
// ligne de log est de l'historique, elle survit à la suppression de la carte (même choix que
// combat_action_targets.target_token_id, 317).
export const up = async (knex) => {
  await knex.schema.createTable('campaign_presence_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('campaign_id').notNullable()
    t.uuid('user_id').notNullable()
    t.text('context').notNullable().defaultTo('session')
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('last_seen_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('ended_at', { useTz: true })
  })

  await knex.raw(`
    ALTER TABLE campaign_presence_sessions
      ADD CONSTRAINT campaign_presence_sessions_campaign_id_foreign
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  `)
  await knex.raw(`
    ALTER TABLE campaign_presence_sessions
      ADD CONSTRAINT campaign_presence_sessions_user_id_foreign
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  `)
  await knex.raw(`
    ALTER TABLE campaign_presence_sessions
      ADD CONSTRAINT chk_campaign_presence_sessions_context
      CHECK (context IN ('session', 'wizard'))
  `)
  await knex.raw(`
    CREATE INDEX campaign_presence_sessions_campaign_user_idx
      ON campaign_presence_sessions (campaign_id, user_id)
  `)
  // Sweep au boot + heartbeat ne touchent que les lignes ouvertes — index partiel dédié.
  await knex.raw(`
    CREATE INDEX campaign_presence_sessions_open_idx
      ON campaign_presence_sessions (campaign_id) WHERE ended_at IS NULL
  `)

  await knex.schema.createTable('campaign_combat_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('campaign_id').notNullable()
    t.uuid('battlemap_id')
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('ended_at', { useTz: true })
  })

  await knex.raw(`
    ALTER TABLE campaign_combat_log
      ADD CONSTRAINT campaign_combat_log_campaign_id_foreign
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  `)
  await knex.raw(`
    ALTER TABLE campaign_combat_log
      ADD CONSTRAINT campaign_combat_log_battlemap_id_foreign
      FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE SET NULL
  `)
  await knex.raw(`
    CREATE INDEX campaign_combat_log_campaign_id_idx ON campaign_combat_log (campaign_id)
  `)
}

export const down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS campaign_combat_log CASCADE`)
  await knex.raw(`DROP TABLE IF EXISTS campaign_presence_sessions CASCADE`)
}
