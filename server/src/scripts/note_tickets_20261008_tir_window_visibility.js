// Script à usage unique — note le vrai correctif de COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY
// (session du 2026-10-08). La note du 2026-10-04 déjà présente en base pointait vers
// COMBAT-RANGE-PLAYER-EDITABLE (commit b247e2ad), un bug différent (fenêtre MJ exclue pour un
// assaut PJ) déjà corrigé avant cette session — pas vers la cause réelle trouvée et corrigée ici.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261008_tir_window_visibility.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-08 : correctif codé (cause réelle) ---'

const NOTE = `

${MARKER}
La note du 2026-10-04 ci-dessus pointait vers COMBAT-RANGE-PLAYER-EDITABLE (commit b247e2ad) : un
bug différent, déjà corrigé avant cette session, et dont rien ne confirmait qu'il explique ce
symptôme-ci. Cause réelle trouvée en relisant useCombatSocket.js : onAttackResult ne mettait à jour
que l'état MJ (setGmAttackResult) quand l'attaquant était un PJ (confirmDamage côté PJ/Drone/Exo ne
pose jamais isPnj, seul critère alors lu) — la cible, si c'était un joueur, ne recevait jamais sa
fenêtre « Résolution du tir ». Corrigé (client/src/lib/useCombatSocket.js, commit 16d80fe0) :
onAttackResult alimente désormais systématiquement les deux états (gmAttackResult ET
targetAttackResult), chaque composant filtrant déjà par isGm/cibleId — qui a tiré n'a jamais été le
bon critère, seule la cible compte.

Extension (retour Saar en session, 2026-10-08) : « tous les joueurs doivent voir ce qu'il se passe
dans le combat, même les non-acteurs » — un joueur ni MJ ni ciblé par le tir ne voyait rien du tout.
Ajouté (CombatOverlay.jsx, commit 468c8316) : un spectateur reçoit désormais le même panneau neutre
que le MJ (CombatResultGM, sans le bouton onApplyStun). Aligne le tir sur le corps-à-corps
(CombatResultMelee), déjà visible de tous sans condition — confirmé par Saar comme le comportement
voulu, pas un bug.

Testé : eslint CombatOverlay.jsx propre, vite build propre (warnings de taille de chunk
préexistants uniquement). Non testé : scénario réel à plusieurs clients simultanés (MJ, cible,
spectateur) — Saar doit confirmer en jeu avant clôture définitive.`

async function run() {
  const code = 'COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'in_progress',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
