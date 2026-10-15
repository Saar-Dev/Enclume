// Script à usage unique — MAP-SCALE-NO-AUTHORITY : correctif partiel (2026-10-15). Détail complet
// docs/JOURNAL8.md. Reste 'in_progress' (pas 'resolved') : le volet "quelle autorité d'échelle"
// (scale_label mort, par carte ou globale) est une question de conception, pas tranchée.
//   node --env-file=.env server/src/scripts/note_ticket_map_scale_no_authority_partial_fix.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : correctif partiel codé (volet fuite de données) ---'

async function run() {
  const t = await db('bug_tickets').where({ linked_bug_code: 'MAP-SCALE-NO-AUTHORITY' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\nVolet 2 (metersPerCell effacé à chaque sauvegarde) corrigé : ajouté à la liste préservée de normalizeSurfaceData (surfaceCore.js), aucun défaut inventé localement (reste dans toWorldDocument). Testé : node --check, nouveau surfaceCore.test.mjs (3/3), surfaceData.test.mjs 61/61, eslint 0, build client OK. Volet 1 (scale_label jamais lu, quelle autorité d'échelle choisir) reste ouvert — question de conception pour Saar, pas un correctif ponctuel. Ticket laissé in_progress tant que le volet 1 n'est pas tranché.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'in_progress',
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] MAP-SCALE-NO-AUTHORITY -> in_progress (correctif partiel)')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
