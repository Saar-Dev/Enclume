// Script à usage unique — passe CHOC-TEST-WRONG-ATTRIBUTION en 'resolved'. Correctif codé et
// commité (cafb0cd, dev/Saar), validation fonctionnelle en session réelle par Saar (2026-09-05) :
// lance-flammes exo en zone (tireur PJ) et CaC (attaquant PNJ), même cible PNJ ("Baboulinet") — le
// Test de Choc affiche bien le nom de la cible dans les deux cas, jamais celui du tireur.
// Lancement manuel, local : node --env-file=.env server/src/scripts/resolve_ticket_choc_test_wrong_attribution.js

import db from '../db/knex.js'

const CODE = 'CHOC-TEST-WRONG-ATTRIBUTION'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Corrigé (commit cafb0cd, dev/Saar) : nouvelle fonction resolveCombatantDisplayIdentity ' +
    '(combatantContextService.js), utilisée aux 7 sites concernés. Validé en session réelle par ' +
    'Saar (2026-09-05) : lance-flammes exo en zone (tireur PJ) et CaC (attaquant PNJ), même cible ' +
    'PNJ ("Baboulinet") — le Test de Choc affiche bien le nom de la cible dans les deux cas.'

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
