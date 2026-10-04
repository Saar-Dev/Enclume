// Script à usage unique — note sur ARMOR-STATS-DISPLAY-INCOMPLETE après le correctif codé le
// 2026-10-04 (commit 449c2ba9). Statut 'in_progress' (pas 'resolved') : code fait, migrations
// testées en aller-retour mais pas encore appliquées définitivement (le seront au prochain
// démarrage du serveur), navigateur pas encore vérifié par Saar.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_armor_stats_display.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Trois causes distinctes, pas une seule : (1) libellés cryptiques ETQ/PRT/E/P → renommés Armure/
Choc (LocationPanel.jsx) ; (2) 7 armures du Livre de Base ont une vraie valeur de Résistance au
choc jamais saisie à l'import (vérifiée page par page contre le texte du livre, migration 381) ;
(3) 16 armures personnelles (dont Gilet en kevlar, confirmé par Saar) étaient taguées source
« Livre de Base » alors qu'elles viennent du Guide Technique — corrigé par étiquette de source
uniquement, aucune valeur de jeu modifiée (migration 382). Testé : build client propre, aller-retour
up()/down() des deux migrations sur la base locale. Non testé : affichage réel en navigateur (armure
équipée avec/sans Choc), et application définitive des migrations (au prochain démarrage serveur).
Détail complet : docs/JOURNAL8.md, docs/SYSTEME/SOURCES.md (nouveau), commit 449c2ba9.`

async function run() {
  const code = 'ARMOR-STATS-DISPLAY-INCOMPLETE'
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
