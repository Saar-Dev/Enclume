// Script à usage unique — note de progression BATTLEMAP-DUPLICATE-INCOMPLETE « Dupliquer une
// carte perd ses entités, son fond 2D, son mode de rendu et ses réglages de grille ». Déjà corrigé,
// jamais reflété en base (statut resté "new", audit 2026-10-13).
// Commit 0b96a39f (2026-10-08) : battlemaps.js — duplicateBattlemapEntities copie entités (position,
// état, overrides, notes GM) + fond 2D + mode de rendu + réglages de grille. Test dédié
// battlemaps.duplicateEntities.test.mjs (97 lignes, DB-backed). Aucune mention de validation UI en
// jeu dans le commit — reste in_progress tant que le clic "Dupliquer" n'est pas vérifié au navigateur.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_battlemap_duplicate_incomplete.js

import db from '../db/knex.js'

const CODE = 'BATTLEMAP-DUPLICATE-INCOMPLETE'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif déjà en place, jamais reflété (audit de synchronisation tickets) ---\n' +
    'Commit 0b96a39f (2026-10-08) : duplicateBattlemapEntities copie entités/fond 2D/mode de rendu/' +
    'grille. Test dédié battlemaps.duplicateEntities.test.mjs (DB-backed). Aucune mention de ' +
    'validation UI en jeu dans le commit — reste in_progress tant que le clic "Dupliquer" n\'est pas ' +
    'vérifié au navigateur.'

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
