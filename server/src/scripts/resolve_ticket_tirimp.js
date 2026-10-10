// Script à usage unique — clôture le ticket TIRIMP « Garde serveur absent sur "Tir impossible" ».
// Vérifié en code (pas supposé) : shared/combatSituationMods.js — pattern `impossible: true` séparé
// du modificateur numérique (plus de sentinel -99), isImpossibleRangedSituation(). Garde câblée côté
// serveur dans socketCombatHelpers.js (resolveAssaultAction + resolveDroneAssaultAction, 2 sites),
// socketCombatExo.js et socketCombatAoe.js.
// Décision de Saar (2026-10-10) : clôturer sans nouveau scénario réel dédié.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_tirimp.js

import db from '../db/knex.js'

const CODE = 'TIRIMP'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : clôturé, correctif déjà en place ---\n' +
    "Relecture confirme isImpossibleRangedSituation (shared/combatSituationMods.js) câblée côté " +
    "serveur sur tous les chemins Tir : resolveAssaultAction, resolveDroneAssaultAction " +
    "(socketCombatHelpers.js), socketCombatExo.js, socketCombatAoe.js. Décision de Saar : clôturer " +
    "sans nouveau scénario réel dédié."

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
