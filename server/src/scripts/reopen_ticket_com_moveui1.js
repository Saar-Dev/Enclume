// Script à usage unique — réouverture de COM-MOVEUI1 : le correctif du 2026-08-22 (bouton "Annuler"
// réparé + légende flottante supprimée) a été testé en jeu réel par Saar et rejeté ("plus ergonomique
// avant, plus d'informations, plus facile") — code entièrement revert (git checkout), rien n'est
// déployé. Rouvert plutôt que laissé resolved à tort.
// Lancement manuel : node --env-file=.env server/src/scripts/reopen_ticket_com_moveui1.js

import db from '../db/knex.js'

const ID = '5d890fc7-bed9-4911-91a1-d3a41a30db00'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)

  const note =
    'Rouvert 2026-08-22 : testé en jeu réel par Saar, rejeté — "plus ergonomique avant, plus ' +
    'd\'informations, plus facile". Code entièrement revert (git checkout, rien de déployé). Reste ' +
    'valide de la session : le bug du bouton "Annuler" (réarmement instantané) est réel et bien ' +
    'root-causé dans useAutoMoveMode.js (dismissedRef/dismissKey), et le clic-attaque ambiant n\'est ' +
    'pas hors-norme (modèle Divinity OS2/BG3). Mais supprimer la légende flottante pour ne garder que ' +
    'la tuile compacte est un choix perdant en usage réel — Saar veut PLUS d\'info visible, pas moins. ' +
    'Prochaine tentative : ne pas toucher à la densité d\'information affichée ; si le bouton "Annuler" ' +
    'doit être corrigé, le faire sans réduire ce qui est montré.'

  await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })

  console.log(`Ticket ${ticket.id} -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
