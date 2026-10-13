// Script à usage unique — clôture CHARSHEET-SKILL-SEARCH : champ de recherche ajouté dans la
// liste des compétences de la fiche personnage (SkillsPanel.jsx), filtre par libellé via
// l'autorité unique shared/textSearch.js#createSearchMatcher. Détail complet : JOURNAL8.md,
// session du 2026-10-13. Validé en jeu réel par Saar le 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_charsheet_skill_search.js

import db from '../db/knex.js'

const CODE = 'CHARSHEET-SKILL-SEARCH'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, validé en jeu réel par Saar ---\n' +
    'Champ de recherche ajouté dans SkillsPanel.jsx, filtre les compétences par libellé via ' +
    'createSearchMatcher (shared/textSearch.js, autorité unique déjà utilisée par InventoryPanel/ ' +
    'EquipmentCatalogPage). Les familles/groupes repliés par l\'accordéon se déplient pendant une ' +
    'recherche active. Détail complet : docs/JOURNAL8.md, session du 2026-10-13.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
