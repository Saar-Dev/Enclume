// Script à usage unique — ticket SESSION-CAMERA-UNLOCK-PLAYER-CENTER, confirmé non construit.
//   node --env-file=.env server/src/scripts/note_ticket_session_camera_unlock.js

import db from '../db/knex.js'

const MARKER = 'À corriger, vérifié 2026-10-15'

async function run() {
  const t = await db('bug_tickets').where({ linked_bug_code: 'SESSION-CAMERA-UNLOCK-PLAYER-CENTER' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER} : aucun contrôle de déblocage/désactivation du centrage automatique — Canvas3D.jsx:1491 ne fait qu'un centrage ponctuel sur le token actif en mode mouvement combat (Sprint 2.5), pas de verrou persistant ni de bouton pour le désactiver. Fonctionnalité jamais construite, pas un correctif à un mécanisme existant.`
  await db('bug_tickets').where({ id: t.id }).update({
    admin_notes: `${t.admin_notes || ''}\n\n--- 2026-10-15 ---\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] SESSION-CAMERA-UNLOCK-PLAYER-CENTER — note ajoutée, statut inchangé')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
