// Script à usage unique — clôture le ticket MELEE-MR « Dégâts CaC calculés sans le MR ».
// Vérifié en code (pas supposé) : le MR (Marge de Réussite) est ajouté aux dégâts CaC aux 4 sites
// réels de server/src/socket/socketCombatHelpers.js (lignes 554, 687, 2246, 2328), chacun commenté
// « MELEE-MR — Dommages_Bruts = Arme + MR + ModDom(FOR) (MANUELSYSCOMBAT §6.2) ».
// Décision de Saar (2026-10-10) : clôturer sans nouveau scénario réel dédié.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_melee_mr.js

import db from '../db/knex.js'

const CODE = 'MELEE-MR'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : clôturé, correctif déjà en place ---\n' +
    "Relecture confirme le MR ajouté aux dégâts CaC aux 4 sites réels de socketCombatHelpers.js " +
    "(lignes 554, 687, 2246, 2328, MANUELSYSCOMBAT §6.2). Décision de Saar : clôturer sans nouveau " +
    "scénario réel dédié."

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
