// Script à usage unique — note de progression WIZ41 : correctif codé, rendu visuel réel restant à
// valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_wiz41.js

import db from '../db/knex.js'

const CODE = 'WIZ41'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé ---\n' +
    "Nouveau filtre « prise en main » (Une main / Deux mains) dans le catalogue d'équipement " +
    '(InventoryPanel.jsx, piste du ticket suivie telle quelle) — classification via ' +
    "handsCategoryForItem, qui réutilise slotOptionsForItem (déjà l'autorité pour le menu " +
    "d'équipement) plutôt que reparser ref_location. Testé : JSON valide, ESLint ciblé (0 nouveau " +
    'problème), npm run build client propre. Non testé : rendu visuel réel (catalogue, fiche ' +
    'personnage ou Étape 6 de création).'

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
