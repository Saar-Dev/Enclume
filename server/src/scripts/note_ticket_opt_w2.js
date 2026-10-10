// Script à usage unique — note de progression OPT-W2 : migration codée et testée (lint + build),
// confirmation visuelle (rendu pixel-identique) restant à faire par Saar avant clôture.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_opt_w2.js

import db from '../db/knex.js'

const CODE = 'OPT-W2'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : migration codée ---\n' +
    "Les 7 fichiers campaignSettings/* + CampaignSettingsPage.jsx (trouvé en chemin, même défaut) " +
    "injectaient leurs styles visuels via des objets JS (sharedStyles.js partagé + deux objets " +
    "locaux) au lieu de classes CSS. Migré : ~35 classes cs-* ajoutées à index.css (mêmes valeurs " +
    "exactes), les 8 fichiers réécrits en className, sharedStyles.js et les deux objets locaux " +
    "supprimés. Bonus trouvé en migrant : une couleur hexadécimale dupliquée en dur (#4caf77) " +
    "remplacée par var(--color-success-soft), valeur identique déjà définie.\n\n" +
    'Testé : eslint sur tout le dossier (0 erreur), build client propre à chaque étape (8 builds ' +
    'intermédiaires). Non testé : confirmation visuelle navigateur des 7 onglets — invariant du ' +
    "chantier = rendu pixel-identique avant/après, seul Saar peut le confirmer."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé statiquement, confirmation visuelle non faite
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
