// Script à usage unique — note de progression STATUT-EVANOUI-I18N-PANEL : correctif codé, scénario
// réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_statut_evanoui_i18n_panel.js

import db from '../db/knex.js'

const CODE = 'STATUT-EVANOUI-I18N-PANEL'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Le code evanoui (posé par la Fatigue) n'avait ni clé i18n status.evanoui ni entrée de panneau " +
    "— WoundReviewCard.jsx (écran de revue MJ) affichait le code brut à défaut de traduction. " +
    "L'icône SVG existait déjà. Corrigé : clé status.evanoui = « Évanoui » ajoutée à fr.json ; " +
    'inPanel: true ajouté au registre sans manualToggle (même patron que burning/acid/decompression ' +
    '— affiché quand actif, jamais cliquable, isActionable l\'exclut déjà automatiquement). Testé : ' +
    'shared/tokenStatusRegistry.test.mjs (23/23, instantané AVANT.panneau mis à jour volontairement), ' +
    'shared/**/*.test.mjs (947/947), JSON valide, node --check, build client propre. Non testé : ' +
    "scénario réel navigateur — faire tomber un personnage à « À bout de force » (Fatigue), " +
    "confirmer le libellé dans l'écran de revue MJ et la présence (non cliquable) dans le panneau."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (pur), scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
