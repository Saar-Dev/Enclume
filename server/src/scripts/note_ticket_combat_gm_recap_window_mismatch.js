// Script à usage unique — note de progression COMBAT-GM-RECAP-WINDOW-MISMATCH « fenêtre
// récapitulative : informations pauvres (coordonnées brutes, aucune arme) ». Déjà corrigé dans
// cette même session (commit 2750848b), jamais reflété en base — oubli identique à BETA-38, découvert
// pendant l'audit de synchronisation des tickets déclenché par cette découverte (2026-10-13).
// Commit 2750848b : payload COMBAT_ACTION_DECLARED enrichi (distance de déplacement, nom d'arme ou
// "Mains nues", distance à la cible) ; format cadré avec Saar avant codage. "Testé : ... 94/94 tests
// DB-backed ... shared/**/*.test.mjs (947/947) ... Non testé : scénario réel en session" (message du
// commit). Reste in_progress tant que cette validation n'est pas confirmée.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_combat_gm_recap_window_mismatch.js

import db from '../db/knex.js'

const CODE = 'COMBAT-GM-RECAP-WINDOW-MISMATCH'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif déjà en place, jamais reflété (audit de synchronisation tickets) ---\n' +
    'Commit 2750848b (même session) : bandeau de déclaration enrichi (distance de déplacement, nom ' +
    'd\'arme ou "Mains nues", distance à la cible), format cadré avec Saar avant codage. "Testé : ... ' +
    '947/947 ... Non testé : scénario réel en session" (message du commit). Reste in_progress tant ' +
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
