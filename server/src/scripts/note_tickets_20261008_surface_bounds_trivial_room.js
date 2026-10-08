// Script à usage unique — SURFACE-DOC-NO-BOUNDS, session du 2026-10-08. Le correctif principal
// (PUT /:id/surface, commit 70872d10) était déjà codé et commité mais le ticket restait en 'new',
// sans aucune note — même oubli administratif que sur d'autres tickets ce jour-là. En le relisant,
// un vrai trou que ce correctif ne couvrait pas a été trouvé et corrigé dans la même session (voir
// NOTE ci-dessous) — donc passage direct en 'resolved' avec les deux correctifs documentés.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261008_surface_bounds_trivial_room.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-08 : trou restant trouvé et corrigé, ticket resolved ---'

const NOTE = `

${MARKER}
Le correctif principal (PUT /api/battlemaps/:id/surface, commit 70872d10) était déjà codé et
commité — scanJsonStructure/checkSurfaceLimits (shared/world/importGuard.js, MAP_LIMITS) branchés
sur la route de sauvegarde de l'éditeur 3D, jamais notés en base ni passés en in_progress.

En relisant tous les points d'écriture de surface_data avant de clore, un second trou identique a
été trouvé : buildTrivialRoomSurfaceData (server/src/routes/battlemaps.js) construit la salle
unique d'une carte 2D directement depuis image_width/image_height/grid_size envoyés par le client,
sans aucun plafond — appelée par POST /api/campaigns/:id/battlemaps (création) et PUT
/api/battlemaps/:id (ré-upload d'image 2D), deux routes que le correctif du 2026-10-04 n'avait
jamais couvertes. Le gel se produirait plus tard, au premier compileSurfaceWorld déclenché sur
cette carte (ouverture éditeur ou arrivée d'un joueur), pas à l'enregistrement.

Corrigé (même autorité, pas une nouvelle) : checkSurfaceLimits posé dans buildTrivialRoomSurfaceData
elle-même, avant prepareSurfaceData — ferme les deux routes d'un coup plutôt que de dupliquer la
garde à chaque site d'appel. scanJsonStructure non nécessaire ici (objet construit par le serveur,
jamais du JSON arbitraire).

Testé : node --check propre, node --test
server/src/routes/battlemaps.buildTrivialRoomSurfaceData.test.mjs (3/3 : cas normal + deux variantes
d'étendue absurde rejetées proprement), node --test shared/world/importGuard.test.mjs
shared/world/surfaceDocument.test.mjs (53/53, aucune régression). Vérifié en base locale : aucune
carte 2D existante, donc aucune carte réelle ne peut casser avec ce correctif — le plafond ne
s'applique qu'à une création ou un ré-upload postérieur à ce commit.`

async function run() {
  const code = 'SURFACE-DOC-NO-BOUNDS'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'resolved',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — statut -> resolved`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
