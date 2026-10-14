// Script à usage unique — note de progression CHANCE-PNJ-WINDOW-UNCLEAR : correctif codé,
// rendu visuel réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session
// du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_chance_pnj_window_unclear.js

import db from '../db/knex.js'

const CODE = 'CHANCE-PNJ-WINDOW-UNCLEAR'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé ---\n' +
    "CatastropheChoiceQueue.jsx affichait toujours « Catastrophe » en titre, même pour une carte sans " +
    "Catastrophe réelle (simple choix de Chance 'Éviter la zone d'effet'). Trouvé au passage : une clé " +
    "combat.json (chance.gmQueue.title) existait pour ce cas mais n'était câblée nulle part (texte " +
    'mort, supprimée). Fix : nouvelle clé chancePopup (« Chance »), le titre choisit entre ' +
    "catastrophePopup et chancePopup selon qu'il y a une vraie Catastrophe ou non. Hors périmètre " +
    "(vérifié RAW) : le lanceur de grenade apparaissant comme sa propre cible est correct, pas touché. " +
    'Testé : JSON valide, ESLint ciblé (0 nouveau problème), npm run build client propre. Non testé : ' +
    'rendu visuel réel en jeu.'

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
