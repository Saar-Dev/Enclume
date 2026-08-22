// Script à usage unique — complète l'historique de COM-MOVEUI1 (déjà resolved) : suite à discussion
// UI/UX avec Saar 2026-08-22 sur la norme du genre (Dofus vs Divinity OS2/BG3), le panneau légende
// flottant a été supprimé (redondant avec les anneaux colorés déjà tracés au sol + la tuile compacte
// du panneau d'action) — au-delà du seul correctif du bouton "Annuler".
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_com_moveui1_declutter.js

import db from '../db/knex.js'

const ID = '5d890fc7-bed9-4911-91a1-d3a41a30db00'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)

  const note =
    'Complément 2026-08-22 : discussion UI/UX avec Saar sur la norme du genre (Dofus = outil ' +
    'sélectionné avant cible ; Divinity OS2/BG3 = clic direct = attaque de base, notre modèle actuel) ' +
    '— confirme que le clic-attaque ambiant n\'est pas hors-norme. En revanche la légende flottante ' +
    '(4 zones/couleurs/distances) était une redite permanente des anneaux déjà tracés au sol : ' +
    'supprimée (CombatOverlay.jsx). Le panneau flottant restant n\'apparaît plus que pour confirmer ' +
    'une destination choisie (pendingMoveSelection) ; l\'info allure/ini reste dans la tuile ' +
    '"Déplacement" du panneau d\'action (déjà existante, jamais supprimée).'

  await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })

  console.log(`Note ajoutée au ticket ${ticket.id}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
