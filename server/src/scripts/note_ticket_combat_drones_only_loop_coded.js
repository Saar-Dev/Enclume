// Script à usage unique — COMBAT-DRONES-ONLY-LOOP : correctif codé (2026-10-15), détail complet
// dans docs/JOURNAL8.md. Reste 'in_progress' (pas 'resolved') : comportement visuel (message
// système dans le chat) — exige la validation de Saar avant clôture (AGENTS.md §Clôture).
//   node --env-file=.env server/src/scripts/note_ticket_combat_drones_only_loop_coded.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : correctif codé (avertissement MJ, pas de blocage automatique) ---'

async function run() {
  const t = await db('bug_tickets').where({ linked_bug_code: 'COMBAT-DRONES-ONLY-LOOP' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\nLe saut ANNONCE→RÉSOLUTION pour un Tour 100% drones autonomes reste intentionnel (docs/Old/PLAN_DRONE.md:258-260), non touché. Correctif : avertissement MJ une seule fois par combat (message chat système) quand ce Tour ne compte plus aucun acteur humain — combat_state.autonomous_notice_sent (migration 394), fonction pure shouldNotifyAutonomousDronesOnly (combatTurnEngine.js, testée 5/5), WS.COMBAT_AUTONOMOUS_DRONES_ONLY, client useCombatSocket.js (même patron que COMBAT_TURN_SKIPPED). Aucune pause/fin automatique — le MJ reste seul décisionnaire (COMBAT_END déjà valide depuis toutes les phases, combatFSM.js). Détail complet docs/JOURNAL8.md. Testé : node --check, eslint, build client, 45/45 combatTurnEngine.test.mjs (base locale) — zéro régression. Non testé : scénario réel navigateur (testable par Saar seul, aucun second client requis) — reste in_progress jusqu'à sa confirmation.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'in_progress',
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] COMBAT-DRONES-ONLY-LOOP -> in_progress (correctif codé, note ajoutée)')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
