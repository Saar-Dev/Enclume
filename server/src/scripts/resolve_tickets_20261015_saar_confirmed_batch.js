// Script à usage unique — Saar confirme en jeu réel (2026-10-15) 3 correctifs déjà notés `in_progress`
// (note déjà écrite par une session précédente, scénario navigateur jamais revalidé jusqu'ici) :
// clôture directe en 'resolved'. Idempotent (skip si déjà résolu). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/resolve_tickets_20261015_saar_confirmed_batch.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : validé en jeu réel par Saar ---'
const CODES = [
  'SESSION-CAMERA-KEYBOARD-SLOW-START',
  'COMBAT-RANGE-PLAYER-EDITABLE',
  'COMBAT-WEAPON-STATUS-GHOST-NO-WEAPON',
  'COMBAT-DODGE-NOTIFICATION-WORDING',
  'COMBAT-GM-RECAP-WINDOW-MISMATCH',
]
// Volontairement PAS dans ce lot (Saar, 2026-10-15) : COMBAT-MULTI-ATTACK-ROUND-BROKEN ("pas sûr" —
// la note elle-même dit "possiblement couvert... ou défaut non identifié faute de repro précise",
// reste in_progress) ; MARCHAND-ERGONOMIE-GENERALE ("probablement pas fait", notes vides, réel).

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  for (const code of CODES) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if (ticket.status === 'resolved') { console.log(`[SKIP] ${code} — déjà resolved`); continue }
    await db('bug_tickets').where({ id: ticket.id }).update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n\n${MARKER}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} -> resolved`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
