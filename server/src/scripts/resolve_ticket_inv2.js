// Script à usage unique — clôture INV2, déjà corrigé et committé (b2d7a0a) mais laissé en
// in_progress. Revérifié 2026-08-22 : addItem/updateItem débitent bien les Sols (forUpdate + check),
// 15/15 tests réels (node --test inventoryService.test.mjs) passent contre PostgreSQL.
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_inv2.js

import db from '../db/knex.js'

const ID = '7bc91dec-eb31-4c84-b8bd-b898e3fbb1d5'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Clos 2026-08-22 : corrigé et committé (b2d7a0a, "INV2 : débit des Sols à l\'ajout/validation ' +
    'd\'un objet"). Revérifié à l\'ouverture de session suivante : addItem/updateItem débitent bien ' +
    'les Sols (verrou forUpdate, patron tradeService.js#executeBuy), 15/15 tests réels ' +
    '(inventoryService.test.mjs) passent contre PostgreSQL. Ticket resté en in_progress par oubli ' +
    'de clôture, pas par absence de correctif.'

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
