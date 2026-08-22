// Script à usage unique — passe WIZ31 en in_progress après correctif (WizardCreation.jsx,
// docs/JOURNAL8.md, 2026-08-22). Pas 'resolved' : correctif CSS/layout, non testable sans
// navigateur. Lancement manuel : node --env-file=.env server/src/scripts/mark_ticket_wiz31_coded.js

import db from '../db/knex.js'

const CODE = 'WIZ31'

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
    'Codé 2026-08-22 : st.body (WizardCreation.jsx) avait overflow:\'hidden\' sans minHeight:0 — un ' +
    'enfant flex grandit avec son contenu sans cette propriété, poussait .wiz-shell (min-height:100vh, ' +
    'pas un plafond) au-delà du viewport, la page entière scrollait en emportant le header. Corrigé en ' +
    'overflowY:\'auto\', minHeight:0 (même patron que step6Sheet, déjà correct pour l\'Étape 7). ' +
    'minHeight:0 aussi ajouté à st.step6 par précaution (scroll imbriqué). Lint + build OK. Non ' +
    'testé : scénario réel navigateur (étape longue, confirmer header fixe pendant le scroll).'

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
