// Script à usage unique — complète COM-MOVEUI1 : Saar a signalé qu'après "Annuler", le clic sur un
// adversaire ne fonctionnait plus non plus (Canvas3D.jsx couplait la détection "case occupée" au
// combatMoveMode ambiant, désarmé par la 2e tentative — le clic-attaque ambiant en dépendait sans
// raison métier). Découplé : la détection tourne désormais dès que le déplacement OU le clic-attaque
// est armé (ambientMapClickActive), seule la préview de chemin sur case vide exige encore le
// déplacement armé.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_com_moveui1_clickattack_decoupled.js

import db from '../db/knex.js'

const ID = '5d890fc7-bed9-4911-91a1-d3a41a30db00'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)

  const note =
    '3e passe 2026-08-22 : Saar signale qu\'après "Annuler" le clic-attaque sur un adversaire ne ' +
    'fonctionnait plus non plus — trouvé root-cause : Canvas3D.jsx (handlePointerMove/handlePointerUp) ' +
    'ne détectait "case occupée par un token" (source du déclenchement clic-attaque ambiant) que sous ' +
    'la garde combatMoveHasPriority(), qui exige combatMoveModeRef truthy. Le désarmement du ' +
    'déplacement (dismissedRef) coupait donc par ricochet le clic-attaque, qui n\'a pourtant aucune ' +
    'dépendance métier au déplacement. Remplacé par ambientMapClickActive() : (combatMoveMode OU ' +
    'clic-attaque enregistré) && pas de mode exclusif — la détection de case occupée tourne dans les ' +
    'deux cas, seule la préview de chemin (case vide) reste conditionnée à combatMoveMode truthy. ' +
    'combatMoveHasPriority() devenu mort, supprimé. eslint (0 nouvelle erreur vs stash HEAD) + build ' +
    'propres. Toujours en attente de validation en jeu réel.'

  await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })

  console.log(`Note ajoutée au ticket ${ticket.id}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
