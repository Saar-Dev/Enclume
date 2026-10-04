// Script à usage unique — note sur MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS après le correctif codé le
// 2026-10-04 (session de correction de bugs). Statut 'in_progress' (pas 'resolved') : codé et
// testé en isolation, pas encore validé avec un vrai second client (scénario ajouté à
// docs/BETATEST.md). Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_map_update_propagated.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Cause racine trouvée : PUT /:id/surface (battlemaps.js, route de sauvegarde de l'éditeur 3D) met
bien à jour la base et le cache serveur du WorldSnapshot, mais n'émettait aucun événement socket —
contrairement à world-move/world-visibility/world-effects du même fichier qui émettent déjà
WORLD_RUNTIME_UPDATED. Un joueur déjà en session ne voyait la carte éditée qu'en rechargeant la
page. Vérification demandée par Saar avant de coder (« est-ce que ça aggrade la structure ? ») :
PUT /:id/voxels et PUT /:id (métadonnées) du même fichier avaient exactement le même trou —
périmètre élargi aux 3 routes, un seul point d'émission partagé (notifyMapUpdated) plutôt que 3
appels recopiés, pour fermer la classe de bug plutôt que le seul symptôme signalé.

Corrigé : nouvel événement MAP_UPDATED (shared/events.js), émis par les 3 routes, écouté par
useEntitySocket.js::onMapUpdated (ignore si ce n'est pas la carte actuellement affichée, sinon
recharge via GET /battlemaps/:id — même requête que MAP_SWITCH). Testé : node --test
battlemapWorldPersistence.test.mjs (3/3) + shared/**/*.test.mjs (941/941, aucune régression),
eslint, vite build. Non testé : scénario réel à deux clients simultanés (MJ édite, joueur voit sans
recharger) — ajouté à docs/BETATEST.md, nécessite plusieurs clients que Saar ne peut pas réunir
seul. Détail complet : docs/JOURNAL8.md, docs/SYSTEME/ARCHITECTURE_SOCKET.md.`

async function run() {
  const code = 'MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS'
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
