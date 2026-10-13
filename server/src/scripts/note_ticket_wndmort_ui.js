// Script à usage unique — note de progression WNDMORT-UI « Fenêtre de déclaration sans repli
// visuel pour Blessure mortelle ». Déjà corrigé, jamais reflété en base (audit 2026-10-13).
// Commit 3cfc4ac0 (2026-08-01) : CombatActionWindow.jsx — fetch GET /char-sheet/:id/wounds, bandeau
// d'avertissement + tuiles Attaque/CaC/Rechargement grisées via isTestBlockingWound (shared/
// woundConstants.js, même fonction que le garde serveur). "Testé : ESLint (0 erreur), JSON valide,
// npm run build propre. Non testé : scénario réel en jeu" (message du commit, malgré son titre
// "clos (décision Saar : validé)" qui porte sur l'approche retenue, pas sur une validation en jeu).
// Reste in_progress tant que cette validation n'est pas confirmée.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_wndmort_ui.js

import db from '../db/knex.js'

const CODE = 'WNDMORT-UI'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif déjà en place, jamais reflété (audit de synchronisation tickets) ---\n' +
    'Commit 3cfc4ac0 (2026-08-01) : fetch wounds + bandeau d\'avertissement + tuiles grisées dans ' +
    'CombatActionWindow.jsx (isTestBlockingWound, shared/woundConstants.js). "Testé : ESLint, build ' +
    '... Non testé : scénario réel en jeu" (message du commit — le titre "clos (décision Saar : ' +
    'validé)" porte sur l\'approche retenue, pas sur une validation en jeu). Reste in_progress tant ' +
    'que cette validation n\'est pas confirmée.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
