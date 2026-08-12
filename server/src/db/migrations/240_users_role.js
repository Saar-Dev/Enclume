// Rôle administrateur global (distinct de campaign_members.role, qui est par campagne).
// role_granted_by/role_granted_at : provenance du dernier changement, jamais un historique complet
// (même patron que char_advantages.acquired_during — voir docs/PLANS/PLAN_ADMIN.md §0.5).
// chk_users_role : défense en profondeur, même patron que chk_vault_transfer_requests_status
// (130_vault_transfer_requests.js) — la base refuse toute valeur hors 'user'/'admin' quelle que soit
// la couche applicative qui tenterait de l'écrire.
export const up = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.text('role').notNullable().defaultTo('user')
    table.uuid('role_granted_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('role_granted_at', { useTz: true }).nullable()
  })

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT chk_users_role
    CHECK (role IN ('user', 'admin'))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role')
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('role_granted_at')
    table.dropColumn('role_granted_by')
    table.dropColumn('role')
  })
}
