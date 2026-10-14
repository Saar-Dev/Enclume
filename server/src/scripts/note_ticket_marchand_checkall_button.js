// Script à usage unique — note de progression MARCHAND-CHECKALL-BUTTON : correctif codé,
// rendu visuel réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session
// du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_marchand_checkall_button.js

import db from '../db/knex.js'

const CODE = 'MARCHAND-CHECKALL-BUTTON'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé ---\n' +
    "L'onglet Catalogue de la fiche MJ d'un Marchand avait déjà des boutons bulk (Tout inclure/" +
    "exclure) ; l'onglet Joueurs autorisés n'en avait pas. Ajouté setAllPlayers (même patron que " +
    'setAllFamilies) + boutons « Tout cocher »/« Tout décocher ». Testé : JSON valide, ESLint ciblé ' +
    '(0 nouveau problème), npm run build client propre. Non testé : rendu visuel réel.'

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
