// Script à usage unique — clôture le ticket BETA-35 « Formulaire d'inscription : contraste
// insuffisant ». Déjà corrigé et validé, jamais reflété en base (audit 2026-10-13, suite BETA-38).
// Commit be69c885 : RegisterPage.jsx réaligné sur le pattern CSS de LoginPage.jsx (classes .login-*,
// tokens --bg-input/--border-subtle réels au lieu des deux tokens inexistants --bg-card/--border-normal).
// "Validé jeu réel par Saar." (message du commit).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_beta35.js

import db from '../db/knex.js'

const CODE = 'BETA-35'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, correctif déjà en place (audit de synchronisation tickets) ---\n' +
    'Commit be69c885 (2026-09-15) : RegisterPage.jsx aligné sur le pattern CSS de sa page sœur ' +
    'LoginPage.jsx au lieu des deux tokens --bg-card/--border-normal inexistants. "Validé jeu réel ' +
    'par Saar" (message du commit) — jamais répercuté sur ce ticket, resté triaged par oubli.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
