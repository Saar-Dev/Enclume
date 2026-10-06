// Script à usage unique — note le correctif codé pour STATUT-BADGES-LIMITE-3 (session de correction
// de bugs du 2026-10-06) : statut reste 'in_progress' (pas 'resolved'), la validation en jeu par
// Saar reste à faire (AGENTS.md § Clôture — fermer un comportement visuel exige sa validation).
// Idempotent (skip si déjà noté). Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/note_tickets_20261006_statut_badges_limite3.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-06 : correctif codé ---'

const NOTE = `

${MARKER}
Cause confirmée par lecture : TokenStatusBadges (TokenPresentation.jsx) tronquait
statuses.slice(0, 3) dans l'ordre brut reçu dès que le token portait plus de 4 statuts — un dead
tardif pouvait ne jamais entrer dans les 3 premiers.

Corrigé (shared/tokenStatusRegistry.js) : nouvelle fonction pure selectVisibleStatusBadges(codes,
{ threshold, maxVisible }) — en dessous du seuil (4, inchangé), aucune troncature ; au-delà, tout
code dont l'entrée registre porte isDeath ou blocksDeclaration (cadavre, étourdi, inconscient) est
TOUJOURS inclus, hors concurrence avec le reste. Patron inspiré de FoundryVTT (statut overlay :
emplacement réservé, jamais dans la file concurrente) plutôt qu'un tri ad hoc dans le composant.
TokenPresentation.jsx délègue entièrement, ne connaît plus aucune règle de priorité.

Testé : shared/tokenStatusRegistry.test.mjs étendu à 23/23 (4 statuts ou moins = aucune troncature ;
dead en dernière position d'origine reste visible ; sans statut critique, troncature identique à
l'ancien comportement ; stunned reste visible aussi) ; eslint ciblé (0 erreur). Non testé : affichage
réel en navigateur (token avec plusieurs statuts empilés) — à faire par Saar avant de clore.
Détail complet : docs/JOURNAL8.md (2026-10-06).`

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'STATUT-BADGES-LIMITE-3' }).first()
  if (!ticket) { console.log('[SKIP] STATUT-BADGES-LIMITE-3 — ticket introuvable'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] STATUT-BADGES-LIMITE-3 — déjà noté'); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'in_progress',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] STATUT-BADGES-LIMITE-3 — note ajoutée, statut -> in_progress')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
