// Script à usage unique — note de progression OPT-W2 (complément) : un premier passage (commit
// 4fccbe89, 2026-10-10) avait migré les valeurs visuelles STATIQUES de campaignSettings/* vers des
// classes CSS, mais son propre script de suivi (note_ticket_opt_w2.js) n'a jamais été lancé — le
// ticket est resté "new". Ce script-ci note le complément fait le 2026-10-14 : les 3 valeurs
// visuelles DYNAMIQUES (opacité calculée depuis un état) qui restaient en `style={}`.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_opt_w2_v2.js
// Ordre d'exécution sans importance avec note_ticket_opt_w2.js (les deux sont additifs sur
// admin_notes) — lancer les deux.

import db from '../db/knex.js'

const CODE = 'OPT-W2'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : complément codé (suite au commit 4fccbe89 du 2026-10-10) ---\n' +
    'Le premier passage avait explicitement scopé aux valeurs visuelles STATIQUES. Il restait 3 ' +
    'valeurs visuelles DYNAMIQUES (opacité calculée depuis un état React) directement dans style={} : ' +
    "CampaignSettingsPage.jsx (nav de section désactivée), SectionDice.jsx (ligne de dé expert " +
    'inactive), SectionSources.jsx (source « de base »). Fix : attribut data-* (même convention que ' +
    '.btn-toggle[data-active] déjà en usage dans ces fichiers) + règle CSS scopée à cet attribut, ' +
    'ou .btn-toggle:disabled (nouveau, symétrique de .btn:disabled) pour le premier cas qui porte déjà ' +
    "l'attribut HTML disabled natif. Testé : ESLint ciblé (0 nouveau problème), npm run build client " +
    'propre. Non testé : rendu visuel réel (les 3 cas sont rares à déclencher en pratique).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // les deux passages sont codés et testés statiquement, confirmation visuelle non faite
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
