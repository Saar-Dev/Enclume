// Script à usage unique — audit 2026-10-15, domaine "autre".
// ENCYCLOPEDIE-NOT-INTEGRATED : [VÉRIFIÉ] Sidebar.jsx a un bouton "sidebar-tools-dropdown-item"
// -> onOpenEncyclopedia() -> t('session.encyclopedia'), câblé aussi dans App.jsx/SessionPage.jsx.
// Intégré depuis.
// DOC-ROADMAP-DECALS-LINE-STALE : [VÉRIFIÉ] docs/ROADMAP.md ligne 117 ("Décorations murales")
// est déjà à jour (révision 2026-10-15), ne mentionne plus "chevauchement non résolu".
//   node --env-file=.env server/src/scripts/resolve_tickets_20261015_autre_batch.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : vérifié par lecture du code/doc réel ---'

const RESOLVED = [
  { code: 'ENCYCLOPEDIE-NOT-INTEGRATED', note: "Intégrée depuis : Sidebar.jsx a un bouton (sidebar-tools-dropdown-item -> onOpenEncyclopedia() -> t('session.encyclopedia')), câblé dans App.jsx et SessionPage.jsx." },
  { code: 'DOC-ROADMAP-DECALS-LINE-STALE', note: "docs/ROADMAP.md ligne 117 (« Décorations murales ») est à jour (révision 2026-10-15) : ne dit plus « chevauchement non résolu », décrit l'état réel (4a/4b faits, conception révisée)." },
]

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')
  for (const { code, note } of RESOLVED) {
    const t = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!t) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
      admin_notes: `${t.admin_notes || ''}\n\n${MARKER}\n${note}`.trim(), updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} -> resolved`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
