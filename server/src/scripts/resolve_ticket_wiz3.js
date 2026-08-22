// Script à usage unique — clôture WIZ-3, confirmé corrigé par Saar (2026-08-22, hors de cette
// session — travail parallèle). Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_wiz3.js

import db from '../db/knex.js'

const CODE = 'WIZ-3'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\nConfirmé corrigé par Saar 2026-08-22 (hors session).`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
