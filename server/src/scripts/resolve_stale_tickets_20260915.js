// Correction ponctuelle — 3 tickets trouvés périmés en base le 2026-09-15 (déjà réglés hors suivi
// bug_tickets, jamais reflétés en base). Idempotent (skip si déjà au statut cible).
//
// Lancer depuis la racine : node --env-file=.env server/src/scripts/resolve_stale_tickets_20260915.js

import db from '../db/knex.js'

const UPDATES = [
  {
    code: 'CHOC-TEST-WRONG-ATTRIBUTION',
    status: 'resolved',
    note: '\n\n--- 2026-09-15 : résolu par Saar, jamais suivi en base (trouvé périmé en triage) ---',
  },
  {
    code: 'UI2',
    status: 'resolved',
    note: '\n\n--- 2026-09-15 : résolu par Saar, jamais suivi en base (trouvé périmé en triage) ---',
  },
  {
    code: 'NATWEAPON-CHOC-DEFENSE-GAP',
    status: 'suspended',
    note: '\n\n--- 2026-09-15 : code déjà fait et poussé (b5e4ce8, 2026-09-05), voir PLAN_NATWEAPON_CHOC_DEFENSE.md §5. ' +
      'Statut suspended (pas resolved) : validation en jeu réelle bloquée par un mécanisme non lié et non implémenté ' +
      '(Saisie CaC, requise par la mutation Corne testée) — à rouvrir quand la Saisie CaC existe.',
  },
]

async function main() {
  for (const { code, status, note } of UPDATES) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) {
      console.log(`[SKIP] ${code} — ticket introuvable`)
      continue
    }
    if (ticket.status === status) {
      console.log(`[SKIP] ${code} — déjà au statut ${status}`)
      continue
    }
    await db('bug_tickets')
      .where({ id: ticket.id })
      .update({
        status,
        admin_notes: (ticket.admin_notes || '') + note,
        reviewed_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
    console.log(`[OK] ${code} — ${ticket.status} → ${status}`)
  }
  await db.destroy()
}

main().catch(err => {
  console.error('ERREUR', err)
  process.exit(1)
})
