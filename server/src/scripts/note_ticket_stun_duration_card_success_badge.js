// Script à usage unique — note de progression STUN-DURATION-CARD-SUCCESS-BADGE : correctif codé,
// rendu visuel réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session
// du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_stun_duration_card_success_badge.js

import db from '../db/knex.js'

const CODE = 'STUN-DURATION-CARD-SUCCESS-BADGE'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé ---\n' +
    "Le jet de durée d'étourdissement (1d6, pas un jet de réussite/échec) émettait isSuccess:true en " +
    'dur, repris sans condition par le rendu générique (badge + teinte verte). Même défaut aux deux ' +
    'émetteurs (statusService.js _applyAutoStun, socketCombatResolution.js COMBAT_STUN_CONFIRM) — ' +
    "corrigés ensemble. Fix : cardType:'duration' au lieu de isSuccess:true ; MessageRendererRegistry.jsx " +
    "n'applique plus badge/teinte pour ce cardType. Testé : node --check serveur, ESLint ciblé " +
    '(0 nouveau problème), npm run build client propre. Non testé : rendu visuel réel en jeu.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (lint + build), rendu visuel réel non validé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
