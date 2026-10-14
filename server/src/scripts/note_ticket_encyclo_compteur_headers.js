// Script à usage unique — note de progression ENCYCLO-COMPTEUR-HEADERS : correctif codé,
// rendu visuel réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session
// du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_encyclo_compteur_headers.js

import db from '../db/knex.js'

const CODE = 'ENCYCLO-COMPTEUR-HEADERS'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : correctif codé ---\n' +
    "L'en-tête du tableau COMPTEUR_BLESSURES_TABLE (blessures-seuils.json) portait les noms des " +
    "gravités (axe des lignes) au lieu des localisations (axe des colonnes), et n'avait que 6 cellules " +
    "pour 7 colonnes réelles (DataTableBlock.jsx n'impose aucune correspondance) — décalé d'une case " +
    "en plus d'être mal nommé. Remplacé par les 6 localisations RAW dans l'ordre de WOUND_LOCATIONS " +
    '(shared/woundConstants.js) : Gravité, Tête, Corps, Bras droit, Bras gauche, Jambe droite, Jambe ' +
    'gauche. Testé : JSON valide, tools/validate-encyclopedia.mjs (0 erreur sur ce fichier), npm run ' +
    'build client propre. Non testé : rendu visuel réel dans l\'Encyclopédie.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (validateur + build), rendu visuel réel non validé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
