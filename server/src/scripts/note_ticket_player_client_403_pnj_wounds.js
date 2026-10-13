// Script à usage unique — note de progression PLAYER-CLIENT-403-PNJ-WOUNDS : correctif codé, même
// cause que COMBAT-WOUNDS-403-PNJ (voir note_ticket_combat_wounds_403_pnj.js). Scénario réel
// navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_player_client_403_pnj_wounds.js

import db from '../db/knex.js'

const CODE = 'PLAYER-CLIENT-403-PNJ-WOUNDS'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Cause trouvée (même bug que COMBAT-WOUNDS-403-PNJ, closes ensemble) : les appelants " +
    "candidats listés par ce ticket (ArmorWoundPanel.jsx, CharacterSheet.jsx) ne sont déclenchés que " +
    "par une ouverture de fiche déjà autorisée côté navigation, jamais un appel surprise. Le vrai " +
    "coupable : client/src/lib/useCharacterSocket.js — onWoundAdded/onWoundUpdated/onWoundRemoved " +
    "(montés une fois pour toute la session) refaisaient sans condition un GET .../wounds à chaque " +
    "événement WOUND_*, diffusé à toute la salle dès qu'un personnage (PJ ou PNJ) encaisse une " +
    "blessure, même chez un client qui n'affiche la fiche de personne — explique le « 3 fois " +
    "d'affilée » (ajout + promotions de sévérité successives sur un même coup). Corrigé : même garde " +
    'que les handlers d\'inventaire du même fichier (inventoryByCharId[characterId] !== undefined) — ' +
    'le refetch ne part que si ce characterId est déjà suivi par ce client. Testé : vérifié ' +
    "qu'ArmorWoundPanel.jsx est l'unique lecteur de woundsByCharId dans tout client/src (aucun risque " +
    'de donnée jamais peuplée), ESLint (0 nouveau problème), build client propre. Non testé : ' +
    'scénario réel navigateur, aucun test automatisé possible (pur client, socket).'

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
