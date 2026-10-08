// Script à usage unique — décision Saar (2026-10-08, en session) : un ticket déjà corrigé et
// commité passe en 'resolved' même sans validation en jeu réel (la validation multi-clients
// n'est pas toujours possible seul) — ne reste plus bloqué en 'in_progress'/'new' par défaut.
// S'applique aux tickets déjà revus en session ce jour-là, chacun avec un commit de correctif
// identifié avec certitude. Exclu volontairement : COMBAT-MULTI-ATTACK-ROUND-BROKEN (pas de commit
// dédié, juste une relecture qui n'a rien trouvé de nouveau, elle-même incertaine) et
// EXOARM-COMBATFILE/WIZ38 (non présentés à Saar dans l'échange qui a motivé cette décision).
// Idempotent (skip si déjà résolu). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261008_resolve_coded_unverified.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-08 : passé en resolved (décision Saar) ---'
const NOTE = `

${MARKER}
Déjà corrigé et commité ; validation en jeu réel à plusieurs clients non faite (pas toujours
possible seul) — décision explicite de Saar en session : ne pas laisser un correctif commité
bloqué en 'in_progress'/'new' en attendant une validation qui peut ne jamais arriver. Rouvrir si un
nouveau symptôme apparaît en jeu.`

const CODES = [
  'COMBAT-DAMAGE-WINDOW-WRONG-TARGET',
  'COMBAT-WINDOW-CLOSES-BEFORE-DONE',
  'MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS',
  'CHARSHEET-ADVANTAGE-SKILL-GATE',
  'CHARSHEET-SKILL-PREREQ-HIDDEN',
  'CHARSHEET-XP-SPEND-CONFIRM',
  'ARMOR-STATS-DISPLAY-INCOMPLETE',
  'COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY',
]

async function run() {
  for (const code of CODES) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); continue }
    if (ticket.status === 'resolved') { console.log(`[SKIP] ${code} — déjà resolved`); continue }
    await db('bug_tickets').where({ id: ticket.id }).update({
      status: 'resolved',
      admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — statut -> resolved`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
