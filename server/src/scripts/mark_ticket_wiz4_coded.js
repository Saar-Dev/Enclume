// Script à usage unique — passe WIZ4 en in_progress après correctif (Step4Experience.jsx,
// docs/JOURNAL8.md, 2026-08-22). Lancement manuel :
// node --env-file=.env server/src/scripts/mark_ticket_wiz4_coded.js

import db from '../db/knex.js'

const CODE = 'WIZ4'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'in_progress' || ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà ${ticket.status}, rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Codé 2026-08-22 : handleRemoveCareer (Step4Experience.jsx) clampe désormais highestSubStep à ' +
    'CAREERS quand careers devient vide, même règle que noCareerYet dans computeInitialSubStep (déjà ' +
    'la référence pour "furthest valid substep"). Portée volontairement limitée au cas démontré par le ' +
    'ticket (retrait de carrière) — une revalidation générale de toutes les sous-étapes n\'a pas été ' +
    'tentée (hors preuve d\'un besoin réel, le filet serveur empêche déjà toute persistance invalide). ' +
    'Lint + build OK. Non testé : scénario réel navigateur.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${fixNote}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
