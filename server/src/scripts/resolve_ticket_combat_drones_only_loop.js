// Script à usage unique — COMBAT-DRONES-ONLY-LOOP : clôture (Saar, 2026-10-15), suite au correctif
// codé dans le même tour (migration 394, shouldNotifyAutonomousDronesOnly, WS.COMBAT_AUTONOMOUS_
// DRONES_ONLY — détail complet docs/JOURNAL8.md). Validation automatisable exhaustive (node --check,
// eslint, build client, 45/45 combatTurnEngine.test.mjs base locale) ; scénario réel navigateur
// (message affiché une seule fois) laissé à Saar, à vérifier de son côté sans bloquer la clôture.
//   node --env-file=.env server/src/scripts/resolve_ticket_combat_drones_only_loop.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : clôturé (Saar) ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const t = await db('bug_tickets').where({ linked_bug_code: 'COMBAT-DRONES-ONLY-LOOP' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\nCorrectif codé et validé par les commandes automatisables (voir note du même jour ci-dessus + docs/JOURNAL8.md). Scénario réel navigateur laissé à Saar (testable seul, aucun second client requis) — à vérifier de son côté, sans bloquer cette clôture.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] COMBAT-DRONES-ONLY-LOOP -> resolved')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
