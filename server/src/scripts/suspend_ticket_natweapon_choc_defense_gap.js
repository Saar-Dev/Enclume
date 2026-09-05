// Script à usage unique — passe NATWEAPON-CHOC-DEFENSE-GAP en 'suspended'. Correctif codé (5 sites,
// server/src/socket/socketCombatHelpers.js) et vérifié (node --check, git diff --check, analyse à
// charge) mais NON commité : la validation en session réelle (Baboulinet/Corne vs PJ en défense
// active) a été rejetée en amont par getNaturalWeaponIneligibilityReasons (shared/naturalWeapons.js,
// chantier PLAN_MUTATION2 antérieur, sans rapport) — la mutation « Corne » exige
// natural_weapon_requires_grapple, mécanique de Saisie CaC pas encore implémentée. Décision Saar
// (2026-09-05) : validation différée à l'implantation de la Saisie CaC, code laissé tel quel dans le
// worktree en attendant.
// Lancement manuel, local : node --env-file=.env server/src/scripts/suspend_ticket_natweapon_choc_defense_gap.js

import db from '../db/knex.js'

const CODE = 'NATWEAPON-CHOC-DEFENSE-GAP'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Correctif codé (5 sites, socketCombatHelpers.js, docs/PLANS/PLAN_NATWEAPON_CHOC_DEFENSE.md) et ' +
    'vérifié (node --check, git diff --check, analyse à charge) mais NON commité. Validation en ' +
    'session réelle (Baboulinet/Corne vs PJ en défense active, 2026-09-05) rejetée en amont par la ' +
    'mécanique de Saisie CaC (natural_weapon_requires_grapple, chantier PLAN_MUTATION2 antérieur), pas ' +
    'encore implémentée. Suspendu jusqu\'à l\'implantation de la Saisie CaC, qui permettra de rejouer le test.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'suspended',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> statut: ${updated.status}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
