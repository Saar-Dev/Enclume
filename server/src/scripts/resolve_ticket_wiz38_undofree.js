// Script a usage unique - cloture WIZ38-UNDOFREE1 : Saar confirme explicitement que le retour
// gratuit a -3 (annulation implicite du cout de deblocage) n'est pas voulu - corrige.
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_wiz38_undofree.js

import db from '../db/knex.js'

const CODE = 'WIZ38-UNDOFREE1'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouve.')

  const note =
    "Corrige 2026-08-22 (Saar confirme explicitement : le retour gratuit n'est pas voulu). " +
    "CareersAllocator.jsx : reducer ALLOC_SKILL recoit desormais floorIsPaid (calcule via le nouveau " +
    "isReservedUnlearned(skillId) - vrai seulement quand baseFor() a retourne le -3 synthetique, pas " +
    "une base d'origine reelle). Redescendre a -3 sur une competence (X) jamais entrainee conserve " +
    "desormais l'allocation (skillAllocations[skillId] = -3) au lieu de la supprimer - calcSkillCost " +
    "facture alors correctement le point de deblocage (cout=1). Le bouton \"-\" reste desactive une " +
    "fois au plancher (row.target <= row.current), donc -3 est bien un vrai palier terminal payant, " +
    "plus une annulation gratuite. eslint + build client propres."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel (wizard) non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
