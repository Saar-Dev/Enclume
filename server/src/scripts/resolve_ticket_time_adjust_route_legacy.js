// Script à usage unique — TIME-ADJUST-ROUTE-LEGACY : clôture (2026-10-15). Route morte
// (POST /campaigns/:id/game-time/adjust) retirée de server/src/routes/campaigns.js — détail complet
// docs/JOURNAL8.md. Cause racine supprimée (plus d'appelant possible), pas documentée comme dette.
//   node --env-file=.env server/src/scripts/resolve_ticket_time_adjust_route_legacy.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : clôturé — route morte retirée ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const t = await db('bug_tickets').where({ linked_bug_code: 'TIME-ADJUST-ROUTE-LEGACY' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\nPOST /api/campaigns/:id/game-time/adjust retirée de campaigns.js (import adjustGameTime retiré avec elle, devenu mort dans ce fichier) : zéro appelant client confirmé (grep exhaustif), remplacée depuis par /request-advance + /confirm-advance (revue MJ). adjustGameTime (gameTimeService.js) reste utilisé en interne par coldExposureService.js/echeanceService.js/fatigueService.js — seule la route HTTP a disparu. Testé : node --check (0 erreur), gameTimeService.test.mjs 16/16 (base locale, zéro régression). Détail complet docs/JOURNAL8.md.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] TIME-ADJUST-ROUTE-LEGACY -> resolved')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
