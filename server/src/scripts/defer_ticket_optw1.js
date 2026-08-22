// Script à usage unique — passe OPT-W1 en suspended (reporté par Saar, 2026-08-22) : nécessite une
// brique "passage du temps de campagne" inexistante côté serveur avant tout câblage réel. Lancement
// manuel : node --env-file=.env server/src/scripts/defer_ticket_optw1.js

import db from '../db/knex.js'

const CODE = 'OPT-W1'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'suspended',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\nReporté par Saar 2026-08-22 — nécessite une brique passage du temps de campagne inexistante.`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
