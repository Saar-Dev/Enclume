// Script à usage unique — ticket MAP-SCALE-NO-AUTHORITY, confirmé toujours non corrigé.
//   node --env-file=.env server/src/scripts/note_ticket_map_scale_no_authority.js

import db from '../db/knex.js'

const MARKER = 'À corriger, vérifié 2026-10-15'

async function run() {
  const t = await db('bug_tickets').where({ linked_bug_code: 'MAP-SCALE-NO-AUTHORITY' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER} : client/src/lib/surfaceCore.js#normalizeSurfaceData (liste fermée de clés) ne mentionne toujours pas metersPerCell (grep vide) — chaque sauvegarde de l'éditeur continue de l'effacer si jamais écrit. scale_label reste non lu ailleurs qu'en liste de cartes.`
  await db('bug_tickets').where({ id: t.id }).update({
    admin_notes: `${t.admin_notes || ''}\n\n--- 2026-10-15 ---\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] MAP-SCALE-NO-AUTHORITY — note ajoutée, statut inchangé')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
