// Script à usage unique — note de suivi sur ASSETS-ROUTE-NO-AUTH. Idempotent (skip si déjà noté).
// Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_assets_route_no_auth.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Correctif : server/src/routes/assets.js monte désormais requireAuth (router.use), conforme à son
propre commentaire « Auth requise ». requireAuth lit un cookie (token, httpOnly, sameSite:lax),
jamais un header Authorization — vérifié que le client charge toujours ces URLs en direct (<img
src>, GLTFLoader.load) sans jeton manuel, donc sans casse possible côté appel.

Point [INCONNU] du ticket d'origine résolu par la lecture : client et serveur sont toujours
same-site au sens SameSite (le port n'entre pas dans la définition de "site") — localhost en dev
(ports différents, même host) et la même IP 89.92.219.211 sur Kiwi (enclume-client:8193,
enclume-server:8194, docs/SERVEURDISTANTKIWI.md). Un cookie sameSite:lax est donc envoyé
normalement sur ces requêtes same-site cross-origin, y compris pour un <img src> ou un GLTFLoader
qui pointe vers l'autre port — aucune régression attendue pour les portraits, GLB et images de
carte déjà en usage réel (100+ sessions).

/api/assets/builtin-models (express.static, server/src/index.js) reste monté séparément et public,
avant ce routeur — modèles génériques non spécifiques à une campagne, hors périmètre de ce ticket.

Trouvaille en passant, PAS corrigée ici (hors périmètre, ticket distinct à ouvrir si confirmé) :
server/src/routes/textures.js (GET /api/textures/:pack/*filePath) est aussi monté sans requireAuth,
mais son commentaire ne revendique aucune authentification (contrairement à assets.js) — pas la même
contradiction documentée, pas traité dans ce chantier.

Testé : node --check. Non testé : aucune suite d'intégration REST n'existe dans ce projet pour les
routes (vérifié, aucun fichier supertest/.test.mjs sur une route Express) — nécessite une
vérification manuelle en navigateur (portraits personnage, GLB token/exo, image de carte, couverture
de campagne continuent de charger normalement après ce correctif) avant de considérer ce ticket clos.`

async function run() {
  const code = 'ASSETS-ROUTE-NO-AUTH'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    status: 'in_progress',
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
