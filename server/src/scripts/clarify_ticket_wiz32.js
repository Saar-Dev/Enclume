// Script à usage unique — clarifie WIZ32 (pas de correctif codé, juste triage) : le ticket décrit
// une asymétrie comme un bug, mais docs/Old/PLAN_WIZARDCOLLAB.md §2.5 la documente comme un choix V1
// explicite ("Réception — asymétrique, assumée"), pour éviter le risque de "double écrivain" (deux
// personnes tapant sur le même champ s'écraseraient). Reste 'new' (pas résolu, pas fermé) : c'est une
// vraie fonctionnalité potentielle (voir le MJ taper en direct avant tout commit), pas un bug, décision
// produit à prendre par Saar avant tout code. Lancement manuel :
// node --env-file=.env server/src/scripts/clarify_ticket_wiz32.js

import db from '../db/knex.js'

const CODE = 'WIZ32'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Clarifié 2026-08-22 (pas de correctif codé) : docs/Old/PLAN_WIZARDCOLLAB.md §2.5 documente cette ' +
    'asymétrie comme un choix V1 explicite ("Réception — asymétrique, assumée"), pas un oubli — évite ' +
    'le risque de "double écrivain" (deux personnes tapant sur le même champ s\'écraseraient sans ' +
    'mécanisme de fusion). L\'"exigence Saar : IMMÉDIATEMENT visible" citée dans WizardCreation.jsx ' +
    'concerne autre chose (le commit "Suivant" d\'un auteur vu par l\'observateur, déjà symétrique et ' +
    'fonctionnel via gmSyncKey/applyStateSync) — pas la frappe en direct avant commit. Ce que le ' +
    'ticket demande en plus (MJ visible en train de taper, avant tout commit, sur la fiche d\'un ' +
    'joueur) est une vraie fonctionnalité à concevoir, pas un bug — décision produit nécessaire avant ' +
    'tout code (verrou d\'édition exclusif ? fusion de champs ?).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> statut inchangé (${updated.status}), note ajoutée.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
