// Script à usage unique — correction de la note précédente sur ASSETS-ROUTE-NO-AUTH : le premier
// correctif noté (requireAuth seul) a été abandonné AVANT commit, remplacé par un jeton signé par
// asset. Idempotent. Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_assets_route_no_auth_v2.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 (suite) : correctif remplacé par un jeton signé ---'

const NOTE = `

${MARKER}
Le correctif noté plus haut (requireAuth seul) n'a PAS été commité — vérifié en relisant les
sources three.js réelles (pas supposé) : GLTFLoader (fetch, credentials:'same-origin') et
TextureLoader/useTexture (Image, crossOrigin:'anonymous') n'envoient jamais le cookie de session
dès que le port diffère, ce qui est le cas en dev ET sur Kiwi. Aurait cassé tous les modèles 3D et
tous les fonds de carte.

Correctif retenu à la place : jeton signé par asset, patron des URLs présignées S3/GCS/Firebase
Storage (server/src/lib/assetUrlSigning.js, nouveau, réutilise jsonwebtoken + JWT_SECRET déjà en
place pour le cookie de session). Le jeton est signé à la source dans glb_url/portrait_url/
image_url/cover_url/default_token_glb_url* avant l'envoi de la réponse REST — zéro changement
client, aucun composant <img>/useGLTF/useTexture à retoucher. assets.js accepte le cookie OU le
jeton. 8/8 tests dédiés (assetUrlSigning.test.mjs). Détail complet : docs/JOURNAL8.md.

Non testé : scénario réel navigateur (portraits, GLB, fonds de carte continuent de charger).`

async function run() {
  const code = 'ASSETS-ROUTE-NO-AUTH'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de correction ajoutée`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
