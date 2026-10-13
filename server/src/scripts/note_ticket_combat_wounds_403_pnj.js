// Script à usage unique — note de progression COMBAT-WOUNDS-403-PNJ : correctif codé, même cause
// que PLAYER-CLIENT-403-PNJ-WOUNDS (voir note_ticket_player_client_403_pnj_wounds.js). Scénario réel
// navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_combat_wounds_403_pnj.js

import db from '../db/knex.js'

const CODE = 'COMBAT-WOUNDS-403-PNJ'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    'La piste d\'origine (CombatActionWindow.jsx ~384-392) ne tenait plus : playerToken y est ' +
    'strictement filtré aux personnages du joueur, son character_id ne peut pas être un PNJ. Vraie ' +
    "cause trouvée : client/src/lib/useCharacterSocket.js — onWoundAdded/onWoundUpdated/" +
    'onWoundRemoved refaisaient sans condition un GET .../wounds à chaque événement WOUND_*, diffusé ' +
    "à toute la salle dès qu'un personnage (PJ ou PNJ) encaisse une blessure, même chez un client qui " +
    "n'affiche la fiche de personne — le serveur refuse à raison (ni propriétaire ni MJ), c'est " +
    "l'appel qui n'avait pas à partir. Même bug que PLAYER-CLIENT-403-PNJ-WOUNDS (closes ensemble). " +
    'Corrigé : même garde que les handlers d\'inventaire du même fichier ' +
    '(inventoryByCharId[characterId] !== undefined) — le refetch ne part que si ce characterId est ' +
    'déjà suivi par ce client (ArmorWoundPanel.jsx l\'a déjà peuplé) ; updateCharacter (badge de ' +
    'sévérité) reste inconditionnel. Testé : vérifié qu\'ArmorWoundPanel.jsx est l\'unique lecteur de ' +
    "woundsByCharId dans tout client/src (aucun risque de donnée jamais peuplée), ESLint (0 nouveau " +
    "problème), build client propre. Non testé : scénario réel navigateur, aucun test automatisé " +
    "possible (pur client, socket) — vérifier qu'un PNJ encaisse une blessure en combat sans 403 au " +
    "journal serveur côté client n'affichant pas sa fiche."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
