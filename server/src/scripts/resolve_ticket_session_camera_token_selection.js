// Script à usage unique — clôture SESSION-CAMERA-TOKEN-SELECTION-UNCLEAR : Tab bascule désormais
// caméra + acteur d'interaction entre mes tokens possédés (PJ/drone/exo) ; le clic continue à ne
// faire QUE sélectionner (décision Saar 2026-09-17, non modifiée). Détail complet : JOURNAL8.md,
// session du 2026-10-13. Validé en jeu réel par Saar le 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_session_camera_token_selection.js

import db from '../db/knex.js'

const CODE = 'SESSION-CAMERA-TOKEN-SELECTION-UNCLEAR'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, validé en jeu réel par Saar ---\n' +
    'Nouveau geste Tab (séparé du clic, qui garde son rôle de sélection/menu existant depuis le ' +
    '2026-09-17) : bascule l\'anneau, la caméra 3e personne (followToken) et l\'acteur des ' +
    'interactions d\'entité entre mes tokens possédés. Nouvel état drivingTokenId (tokenStore.js), ' +
    'nouveau paramètre preferredOwnedTokenId sur resolveActingToken (actingToken.js), une seule ' +
    'autorité partagée entre Canvas3D.jsx (caméra) et SessionPage.jsx (2 sites d\'interaction). ' +
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
