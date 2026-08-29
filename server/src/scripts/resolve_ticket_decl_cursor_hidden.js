// Script à usage unique — clôture DECL-CURSOR-HIDDEN après correctif (SceneCursorOverlay.jsx,
// refonte hit-test explicite, validé navigateur par Saar le 2026-08-29, cf. docs/JOURNAL8.md).
// Lancement manuel, local uniquement :
//   node --env-file=.env server/src/scripts/resolve_ticket_decl_cursor_hidden.js
//
// Idempotent : ne fait rien si le ticket est déjà resolved.

import db from '../db/knex.js'

const CODE = 'DECL-CURSOR-HIDDEN'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà résolu.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Corrigé 2026-08-29 (validé navigateur Saar) : SceneCursorOverlay.jsx refondu. Cause racine — ' +
    'existence de l\'overlay <img> CASE/CIBLE dérivée d\'un état implicite (un pointermove canvas ' +
    'reçu sans pointerleave depuis) ; au changement de mode le curseur natif passait à \'none\' ' +
    'immédiatement mais l\'overlay attendait un 1er pointermove canvas qui ne venait pas (le clic ' +
    'd\'armement part de la fenêtre de déclaration, pas du canvas). Correctif : suivi pointeur unique ' +
    'au niveau document, visibilité via hit-test document.elementFromPoint recalculé au move ET au ' +
    'changement de mode (elementFromPoint ignore pointer-events:none et respecte l\'occlusion), ' +
    'resolveCursorStyle prend overlayVisible -> invariant dur cursor:\'none\' <=> overlay monté, ' +
    'curseur invisible structurellement impossible. vite build propre, eslint iso-baseline.'

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
