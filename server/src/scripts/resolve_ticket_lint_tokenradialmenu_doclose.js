// Script à usage unique — clôture le ticket LINT-TOKENRADIALMENU-DOCLOSE.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_lint_tokenradialmenu_doclose.js

import db from '../db/knex.js'

const CODE = 'LINT-TOKENRADIALMENU-DOCLOSE'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : clôturé ---\n' +
    "doClose remonté avant l'effet qui le référence, enveloppé dans useCallback ([onClose]), ajouté " +
    "aux dépendances de l'effet. eslint ciblé : 0 erreur, 0 warning (contre 1 erreur + 1 warning " +
    'avant). Build client propre. Aucun changement de comportement.'

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
