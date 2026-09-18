// Script à usage unique — clôture INI1 : « Surprise critique (roll=1) → initiative=1 ».
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_ini1.js

import db from '../db/knex.js'

const CODE = 'INI1'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    "Corrigé 2026-09-18 : le Test de Réaction (COMBAT_SURPRISE_RESULT, socketCombatState.js) faisait " +
    "une comparaison brute diceRoll <= base_ini au lieu du pipeline de Test partagé " +
    "(resolveTestOutcome/getCriticalSuccessBonus/applyCriticalSuccessBonus) - une Réussite critique " +
    "ne recevait jamais le bonus RAW sur l'Initiative obtenue. Élargi en testant (2 retours Saar) : " +
    "extraction de server/src/lib/surpriseService.js (autorité unique du Test, même patron que " +
    "gmArbitratedTestService.js/woundService.js) car le jet auto PNJ (COMBAT_START) avait une seconde " +
    "formule divergente (base_ini + roll, jamais d'échec possible, aucun DICE_RESULT émis) ; puis " +
    "déplacement de la résolution PNJ dans advanceAnnouncementQueue (combatTurnEngine.js) pour que " +
    "chaque PNJ surpris soit révélé à son propre tour d'ANNONCE, plus tous d'un coup à COMBAT_START " +
    "(gameplay). Détail complet : docs/SYSTEME/COMBAT.md § 'Surprise — Test de Réaction', " +
    "docs/JOURNAL8.md session du 2026-09-18. Testé : combatTurnEngine.test.mjs 27/27 (2 nouveaux cas " +
    "déterministes), confirmé en jeu réel par Saar (Réussite critique observée en conditions réelles)."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
