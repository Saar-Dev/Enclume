// Script à usage unique — note de progression WEAPON-MOD-BUTTON-CONTRAST : correctif codé,
// rendu visuel réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session
// du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_weapon_mod_button_contrast.js

import db from '../db/knex.js'

const CODE = 'WEAPON-MOD-BUTTON-CONTRAST'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé ---\n' +
    "Le bouton « Modification d'arme » (WeaponPanel.jsx) avait un style fait main peu contrasté " +
    '(texte #5a5a7a sur fond quasi identique, 11px) — remplacé par le bouton standard du projet ' +
    "(className=\"btn btn-ghost\"), même convention que le reste de la fiche personnage. Au passage, " +
    "trouvé et corrigé le même défaut sur 9 autres boutons (4 fichiers : DroneSheet.jsx, " +
    'DroneWindow.jsx x3, ExoSettingsPanel.jsx x3, CatastropheChoiceQueue.jsx x2) qui portaient ' +
    "className=\"btn-ghost\" SANS \"btn\" — le sélecteur CSS .btn.btn-ghost exige les deux classes, " +
    'ces boutons ne recevaient donc aucun style. Testé : ESLint ciblé (0 nouveau problème), npm run ' +
    'build client propre. Non testé : rendu visuel réel des 10 boutons en jeu/navigateur.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (lint + build), rendu visuel réel non validé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
