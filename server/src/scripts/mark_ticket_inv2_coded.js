// Script à usage unique — passe INV2 en in_progress après correctif (inventoryService.js,
// char-sheet.js, InventoryPanel.jsx, docs/JOURNAL8.md, 2026-08-22). Lancement manuel :
// node --env-file=.env server/src/scripts/mark_ticket_inv2_coded.js

import db from '../db/knex.js'

const CODE = 'INV2'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'in_progress' || ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà ${ticket.status}, rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Codé 2026-08-22 : décision Saar — débit à la validation MJ (personnage en campagne), débit à ' +
    'l\'ajout (personnage Coffre-native, aucun MJ ne validera jamais). Ajout MJ toujours gratuit. ' +
    'inventoryService.js#_chargeSols (verrou forUpdate + vérif avant décrément, même patron que ' +
    'tradeService.js#executeBuy). 6 tests ajoutés (15/15 vertes, PostgreSQL réel). Erreurs ' +
    'désormais visibles côté UI (InventoryPanel.jsx, auparavant console.error silencieux). Détail ' +
    'complet docs/JOURNAL8.md, session "INV2". Non testé : scénario réel navigateur.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${fixNote}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
