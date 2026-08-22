// Script à usage unique — corrige le nom de table cité dans le ticket "Catalogue marchand ignore
// ref_exo_equipment" (id c9915238) : la table s'appelle désormais ref_exo_template_equipment (refonte
// exo-armures, sessions 2026-08-19/20/21) — ref_exo_equipment n'existe plus. Le fond du ticket reste
// valide : tradeService.js#getCatalog ne lit que ref_equipment, jamais les systèmes/armes exo.
// Lancement manuel : node --env-file=.env server/src/scripts/clarify_ticket_marchand_exo.js

import db from '../db/knex.js'

const ID = 'c9915238-ff6c-4073-8d13-75488f250d9b'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Vérifié 2026-08-22 : le fond reste valide — tradeService.js (getCatalog, ~ligne 128) ne lit ' +
    'que ref_equipment, jamais les systèmes/armes exo. Nom de table corrigé : ref_exo_equipment ' +
    'n\'existe plus (relation absente), la table actuelle est ref_exo_template_equipment ' +
    '(refonte exo-armures, sessions 2026-08-19/20/21).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> statut inchangé (${updated.status}), nom de table corrigé.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
