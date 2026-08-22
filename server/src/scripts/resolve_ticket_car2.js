// Script à usage unique — clôture CAR2 après migration 311 (server/src/db/migrations/,
// docs/JOURNAL8.md, 2026-08-22). Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_car2.js

import db from '../db/knex.js'

const CODE = 'CAR2'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà résolu.`)
    return
  }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Corrigé 2026-08-22 : migration 311 ajoute la FK ref_background_skills.skill_id -> ref_skills.id ' +
    '(ON DELETE RESTRICT, même patron que ref_career_skills/migration 252). Aucune ligne orpheline ' +
    'trouvée avant migration — appliquée sans nettoyage de données.'

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

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
