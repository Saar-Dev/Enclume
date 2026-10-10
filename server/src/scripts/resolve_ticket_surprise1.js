// Script à usage unique — clôture le ticket SURPRISE1 « is_surprised jamais remis à false après
// COMBAT_START ».
// Vérifié en code (pas supposé) : server/src/socket/combatTurnEngine.js:962 — endTurn() remet
// is_surprised à false pour chaque combattant (commenté comme tel, SURPRISE1). Consommé par
// isTargetDefenseless (socketCombatHelpers.js:1061, bonus cible sans défense + pas d'opposition).
// Décision de Saar (2026-10-10) : clôturer sans nouveau scénario réel dédié.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_surprise1.js

import db from '../db/knex.js'

const CODE = 'SURPRISE1'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : clôturé, correctif déjà en place ---\n' +
    "Relecture confirme combatTurnEngine.js:962 : endTurn() remet is_surprised à false. Consommé par " +
    "isTargetDefenseless (surprise = sans défense pendant le Tour, pas d'opposition). Décision de " +
    "Saar : clôturer sans nouveau scénario réel dédié."

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
