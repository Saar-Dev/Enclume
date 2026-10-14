// Script à usage unique — note de progression WIZ44 : correctif « diviser un empilement » codé,
// rendu visuel réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session
// du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_wiz44.js

import db from '../db/knex.js'

const CODE = 'WIZ44'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé (diviser une pile) ---\n' +
    "Premier jet faux (compris comme un simple +/- de quantité) corrigé en cours de route : la vraie " +
    "demande est de pouvoir diviser un empilement en deux piles (ex. détacher 2 grenades sur 5 pour " +
    "les déplacer séparément). Nouvelle route POST .../inventory/:itemId/split { quantity } → " +
    "inventoryService.splitItem : décrémente la ligne source, insère une nouvelle ligne (même " +
    "container) avec la quantité détachée — jamais un achat. Refus si la quantité détachée >= " +
    'quantité totale (la source garde toujours au moins 1). Bouton « Diviser » dans InventoryPanel.jsx, ' +
    "visible seulement si quantity > 1 ; la pile détachée se déplace ensuite par glisser-déposer " +
    'existant, aucune nouvelle logique de déplacement. Testé : 3 nouveaux tests ciblés DB réelle ' +
    '(37/37 sur inventoryService.test.mjs), ESLint ciblé (0 nouveau problème), npm run build client ' +
    'propre. Non testé : rendu visuel réel (diviser puis glisser la nouvelle pile).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (tests ciblés + lint + build), rendu visuel réel non validé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
