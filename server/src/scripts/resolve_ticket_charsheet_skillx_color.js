// Script à usage unique — clôture CHARSHEET-SKILLX-COLOR : compétences (X) non débloquées
// colorées en or (--color-gold-muted) uniquement en mode Progression. Au passage, toute la chaîne
// de couleurs de SkillsPanel.jsx réalignée sur les tokens CSS déjà établis du projet (index.css,
// famille --*-session-*) au lieu de hex inventés localement. Détail complet : JOURNAL8.md, session
// du 2026-10-13. Validé en jeu réel par Saar le 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_charsheet_skillx_color.js

import db from '../db/knex.js'

const CODE = 'CHARSHEET-SKILLX-COLOR'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, validé en jeu réel par Saar ---\n' +
    '(X) non débloquée colorée en or (--color-gold-muted) uniquement en mode Progression (seul ' +
    'contexte où l\'action "débloquer" est possible). Au passage, toute la chaîne de couleurs du ' +
    'panneau (normale/-3/PN/verrouillée) réalignée sur les tokens CSS déjà établis du projet ' +
    '(index.css, famille --*-session-*) au lieu de hex inventés localement. Visibilité des ' +
    'compétences non débloquées hors Progression non modifiée (décision 2026-10-04 maintenue). ' +
    'Détail complet : docs/JOURNAL8.md, session du 2026-10-13.'

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
