// Script à usage unique — clôture le ticket "Migrations Knex désynchronisées entre environnements"
// (id 221f493a), confirmé résolu par la refonte docs/PLAN_MIGRATIONS_REFONTE.md Phase 2 déjà menée le
// 2026-08-22 (même jour, avant ce triage) : le split 233/243 et les migrations 244-246 mortes ont été
// éliminés, server/src/db/migrations_archive/ contient l'historique pré-refonte. Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_migrations_desync.js

import db from '../db/knex.js'

const ID = '221f493a-896b-41b6-8f60-a457b8601988'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  if (ticket.status === 'resolved') {
    console.log(`Ticket déjà résolu.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Résolu par PLAN_MIGRATIONS_REFONTE.md Phase 2 (2026-08-22, même jour) : le split 233/243 et les ' +
    'migrations 244-246 mortes (jamais exécutables) ont été éliminés par la refonte complète du ' +
    'système de migrations. Historique pré-refonte conservé dans server/src/db/migrations_archive/. ' +
    'Vérifié par filesystem avant clôture (pas seulement supposé).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${fixNote}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
