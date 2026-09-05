// Script à usage unique — confirme la reproduction en session réelle du ticket
// EXODRONE-CONFIRMDAMAGE-CRASH (Saar, 2026-09-05) : Drone armé du Fusil Gauss, Tir sur un PJ, le PJ
// confirme ses dégâts → aucun dégât appliqué. Correspond exactement au mécanisme prédit par lecture
// de code (docs/PLANS/PLAN_CHOC_EXO_DRONE.md §2.2, Palier 0). Statut inchangé ('triaged') — le
// correctif n'est pas encore codé, seule la reproduction passe de "pas encore observée" à
// "confirmée en jeu réel".
// Lancement manuel, local : node --env-file=.env server/src/scripts/confirm_repro_exodrone_confirmdamage_crash.js

import db from '../db/knex.js'

const CODE = 'EXODRONE-CONFIRMDAMAGE-CRASH'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Reproduit en session réelle par Saar (2026-09-05) : Drone armé du Fusil Gauss, Tir sur un PJ ' +
    '(confirmé "touché"), le PJ confirme ses dégâts (COMBAT_DAMAGE_CONFIRM) → aucun dégât appliqué ' +
    'côté PJ. Correspond exactement au mécanisme prédit par lecture de code (crash silencieux dans ' +
    'confirmDamage, weaponInvId undefined pour un tireur drone). Reproduction confirmée — méthodologie ' +
    'docs/SYSTEME/TICKETS.md §4 étape 2 satisfaite. Correctif prévu : PLAN_CHOC_EXO_DRONE.md, Palier 0.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> statut inchangé (${updated.status}), reproduction confirmée.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
