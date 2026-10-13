// Script à usage unique — clôture le ticket SESSION-CAMERA-STUCK-NO-ARROW-KEYS « La vue caméra
// semble bloquée/centrée sur une cible indéterminée en session ; les touches directionnelles ne la
// déplacent pas ». Détail complet : JOURNAL8.md, session du 2026-10-13.
// Validé en jeu réel par Saar le 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_session_camera_stuck_arrow_keys.js

import db from '../db/knex.js'

const CODE = 'SESSION-CAMERA-STUCK-NO-ARROW-KEYS'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, validé en jeu réel par Saar ---\n' +
    "Deux symptômes rapportés ensemble, un seul bug réel. « Caméra centrée sur une cible " +
    'indéterminée » = comportement voulu (3e personne active par défaut dès qu\'un token est ' +
    'possédé, sortie via Échap) — déjà clarifié par SESSION-CAMERA-TOKEN-SELECTION-UNCLEAR (Tab), ' +
    'pas de second correctif. « Les flèches ne déplacent pas la caméra » = vrai bug corrigé : ' +
    "Canvas3D.jsx, l'effet orbitRef.current.listenToKeyEvents(window) passe de deps [] à deps " +
    '[thirdPersonCameraActive] — il se réexécute désormais à chaque bascule 3e-personne ↔ libre, au ' +
    'lieu d\'une seule fois au montage initial (où MapControls/orbitRef n\'existe pas encore en 3e ' +
    'personne par défaut). Testé : ESLint (0 nouveau problème), build client propre, scénario réel ' +
    'navigateur (Échap puis flèches, plusieurs allers-retours) validé par Saar.'

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

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
