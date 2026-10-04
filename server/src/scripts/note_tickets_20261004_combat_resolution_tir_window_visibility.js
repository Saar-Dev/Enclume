// Script à usage unique — note de suivi sur COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY : lien probable
// avec COMBAT-RANGE-PLAYER-EDITABLE corrigé le même jour. NE CHANGE PAS le statut (comportement
// visuel — attend confirmation de Saar avant clôture, AGENTS.md § Clôture). Idempotent.
// Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_combat_resolution_tir_window_visibility.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : lien probable avec COMBAT-RANGE-PLAYER-EDITABLE ---'

const NOTE = `

${MARKER}
Signalé le 2026-10-03, sans diagnostic précis ni condition de repro. Probablement le même symptôme
que COMBAT-RANGE-PLAYER-EDITABLE (corrigé le 2026-10-04, voir ce ticket + docs/JOURNAL8.md) : avant
ce correctif, CombatOverlay.jsx excluait explicitement l'assaut à distance d'un PJ
(gmActiveCharacter?.type !== 'pj') du rendu de CombatModifiersWindow côté MJ — la fenêtre
« Résolution du tir » n'apparaissait donc réellement que pour certains clients (le joueur, jamais
le MJ, pour SON PROPRE PJ). Cette exclusion est retirée depuis le 2026-10-04 (commit b247e2ad).

Pas de clôture automatique ici — aucune condition de repro précise n'avait été fournie à l'origine,
donc aucune certitude que ce soit exactement le même symptôme. À confirmer par Saar au prochain
test en jeu (la fenêtre de Résolution du tir apparaît-elle désormais bien pour le MJ ET le joueur ?)
avant de marquer ce ticket résolu.`

async function run() {
  const code = 'COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée (statut inchangé, attend confirmation Saar)`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
