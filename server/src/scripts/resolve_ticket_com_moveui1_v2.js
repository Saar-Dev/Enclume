// Script à usage unique — clôture COM-MOVEUI1 (2e tentative, 2026-08-22). La 1re tentative (bouton
// "Annuler" réparé + légende flottante supprimée) a été testée en jeu réel et rejetée par Saar (moins
// d'info, jugé moins ergonomique) — entièrement revert. Nouvelle demande, plus précise : garder TOUTE
// l'info affichée (légende comprise, intacte), mais quand "Annuler" est cliqué, plus aucune tuile ne
// doit déplacer le token tant que le joueur n'a pas explicitement recliqué sur l'action "Déplacement".
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_com_moveui1_v2.js

import db from '../db/knex.js'

const ID = '5d890fc7-bed9-4911-91a1-d3a41a30db00'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '2e tentative 2026-08-22 : légende et panneau flottant intacts (rien retiré cette fois). ' +
    'useAutoMoveMode.js gagne un dismissedRef + rearm() : "Annuler" désarme le survol pour le reste ' +
    'de l\'activation (aucune tuile ne déplace plus le token), levé uniquement par (a) un nouveau ' +
    'tour/activation (enabled faux→vrai) ou (b) un clic explicite sur la tuile "Déplacement", qui ' +
    'appelle désormais rearm() en plus d\'effacer une sélection déjà posée — aux 3 sites d\'appel ' +
    '(CombatActionWindow PJ, CombatGmDeclareWindow PNJ, useDroneDeclare drone, PJ et GM). eslint + ' +
    'build propres. Validation en jeu réel toujours à faire par Saar avant clôture définitive.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // reste in_progress : correctif codé, pas encore validé en jeu
      priority: 'high',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status} (attente validation jeu réel)`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
