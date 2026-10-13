// Script à usage unique — note de progression INI5 « CaC : forfait Initiative de déclaration
// (-3/-5) doublon avec le décalage de phase ». Déjà tranché, jamais reflété en base (audit 2026-10-13).
// Commit 42298070 (Session 176, 2026-07-25), docs/BUGIDENTIFIE.md : "INI5 clos (audit git blame +
// relecture RAW p.218-219 : forfait -3/-5 introduit Session 65, 94 sessions avant
// computeSeriesPositions, aucune base RAW — décision Saar : retiré, serveur + client + i18n ...
// non testé en jeu)". Mécanique retirée (pas un correctif additif) ; reste in_progress tant que la
// validation en jeu n'est pas confirmée.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_ini5.js

import db from '../db/knex.js'

const CODE = 'INI5'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : décision déjà actée, jamais reflétée (audit de synchronisation tickets) ---\n' +
    'Commit 42298070 (Session 176, 2026-07-25), docs/BUGIDENTIFIE.md : forfait Initiative -3/-5 ' +
    'retiré (serveur + client + i18n) — audit git blame + RAW p.218-219 : introduit Session 65, 94 ' +
    'sessions avant computeSeriesPositions, aucune base RAW. "non testé en jeu" (même source) — ' +
    'reste in_progress tant que cette validation n\'est pas confirmée.'

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
