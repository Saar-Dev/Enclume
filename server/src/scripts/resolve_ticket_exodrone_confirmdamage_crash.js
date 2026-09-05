// Script à usage unique — passe EXODRONE-CONFIRMDAMAGE-CRASH en 'resolved'. Correctif codé et
// commité (9a981b0, dev/Saar), validation fonctionnelle en session réelle par Saar (2026-09-05,
// même scénario que la reproduction : Drone + Fusil Gauss, Tir sur un PJ) — log serveur confirme
// applyStunWithDuration + résolution de dégâts normale, plus aucune erreur confirmDamage.
// Lancement manuel, local : node --env-file=.env server/src/scripts/resolve_ticket_exodrone_confirmdamage_crash.js

import db from '../db/knex.js'

const CODE = 'EXODRONE-CONFIRMDAMAGE-CRASH'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Corrigé (commit 9a981b0, dev/Saar) : confirmDamage ne fetche plus char_inventory quand ' +
    'weaponInvId est absent (tireur exo/drone), repli direct sur la formule stockée. Validé en ' +
    'session réelle par Saar (2026-09-05), même scénario que la reproduction (Drone + Fusil Gauss, ' +
    'Tir sur un PJ) : log serveur confirme applyStunWithDuration + résolution de dégâts normale, ' +
    'aucune erreur confirmDamage. Le Choc (2D6 etc.) reste absent pour un tireur exo/drone à ce ' +
    'stade — suite du chantier, PLAN_CHOC_EXO_DRONE.md Paliers A-D, pas encore codés.'

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

  console.log(`Ticket ${CODE} (id=${updated.id}) -> statut: ${updated.status}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
