// Script à usage unique — clôture le ticket BETA-36 « Compte d.lebosse@protonmail.com pas admin
// sur le serveur distant ». Pas un bug de code : Saar a corrigé directement le compte admin manquant
// sur Kiwi (erreur de migration BDD, pas la cause ADMIN_BOOTSTRAP_EMAIL supposée dans le diagnostic
// initial). Déjà noté par Saar dans le commit 33e5c698 (2026-09-15, "déjà corrigé ... plus un bug
// ouvert", retrait de l'entrée du script d'import pour ne pas la recréer) — jamais reflété sur le
// ticket déjà existant en base, créé le 2026-09-05 avant ce commit. Audit 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_beta36.js

import db from '../db/knex.js'

const CODE = 'BETA-36'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, déjà réglé par Saar hors code (audit de synchronisation tickets) ---\n' +
    'Commit 33e5c698 (2026-09-15) : "Saar a corrigé le compte admin manquant sur Kiwi directement ' +
    '(erreur de migration, pas la cause ADMIN_BOOTSTRAP_EMAIL supposée dans le diagnostic initial) — ' +
    'plus un bug ouvert" — ce commit a seulement retiré l\'entrée du script d\'import pour ne pas la ' +
    'recréer, jamais clôturé le ticket déjà existant en base (créé le 2026-09-05, avant ce commit).'

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
