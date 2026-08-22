// Script à usage unique — clôture CS4, ticket périmé : vérifié en base avant clôture. La famille de
// compétences "Techniques" existe déjà intégralement dans ref_skills (32 compétences seedées :
// Mécanique, Électronique, Informatique, Génie technique, Piratage informatique, Chirurgie,
// Explosifs, etc.) — exactement l'inverse de "non implémentée". Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_cs4.js

import db from '../db/knex.js'

const CODE = 'CS4'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà résolu.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const count = await db('ref_skills').where({ family: 'Techniques' }).count('* as n').first()

  const fixNote =
    `Périmé, vérifié 2026-08-22 : la famille "Techniques" existe déjà en base (${count.n} ` +
    'compétences seedées — Mécanique, Électronique, Informatique, Génie technique, Piratage ' +
    'informatique, Chirurgie, Explosifs, etc.). Aucun correctif nécessaire.'

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
