// Script à usage unique — note sur CHARSHEET-XP-SPEND-CONFIRM après le correctif codé le 2026-10-04
// (session de correction de bugs). Statut 'in_progress' (pas 'resolved') : codé et testé en
// isolation (lint, build, tests partagés), pas encore validé en navigateur par Saar.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_xp_spend_confirm.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Périmètre clarifié par Saar en cours de chantier : uniquement l'XP (compétences), jamais le
bouton « Modif. PC » d'Attribut (PC = Point de Création, création de personnage uniquement, pas
concerné par ce ticket — signalé à part comme question RAW possible, non traitée ici).

Aucun changement serveur : POST /skills/buy reste l'autorité unique, inchangée. Ajout d'une file
d'attente purement cliente dans SkillsPanel.jsx (pendingPurchases) — un clic sur "+" empile un
point au lieu d'appeler le serveur ; computePreview inclut déjà les points en attente dans
Maîtrise/Total/déverrouillage de prérequis. Nouvelle fenêtre flottante
SkillPurchaseConfirmWindow.jsx (même patron que WoundReviewWindow.jsx) : apparaît dès qu'un point
est en attente, retrait ciblé par ligne, Annuler (vide la file sans requête) et Valider (rejoue la
file dans l'ordre, un appel /skills/buy par point — identique à un clic direct d'avant ce
correctif ; arrêt + erreur affichée si un appel échoue en cours de route).

Testé : node --test shared/skillRequirements.test.mjs (14/14, non régression), eslint (0 erreur
nouvelle), vite build. Non testé : scénario réel en navigateur (empiler plusieurs points, retirer
une ligne, Valider, Annuler) — Saar peut le reproduire seul. Détail complet : docs/JOURNAL8.md.`

async function run() {
  const code = 'CHARSHEET-XP-SPEND-CONFIRM'
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
