// Script à usage unique — note de suivi sur CONNECTOR-MODEL-URL-ABSOLUTE. Idempotent.
// Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_connector_model_url_absolute.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 : correctif codé ---'

const NOTE = `

${MARKER}
Correctif : shared/world/surfaceDocument.js (validateSurfaceData, branche connectors) refuse
modelGlbUrl non-string ou commençant par http://, https:// ou // (protocol-relative) — appliqué à
la sauvegarde (prepareSurfaceData -> assertSurfaceData, déjà le seul point d'entrée, aucune
nouvelle route). null/absent restent valides. Défense en profondeur côté client
(SurfaceDungeonScene.jsx::connectorAssetUrl) : bascule vers le repli cube plutôt que de charger une
URL absolue ou planter sur une valeur non-string, même pour une carte déjà enregistrée avant ce
correctif (la validation serveur ne s'applique qu'aux futures sauvegardes).

Vérifié en base (local) : aucune donnée existante concernée. Testé : nouveau test dédié dans
surfaceDocument.test.mjs, shared/**/*.test.mjs (942/942), eslint (0 erreur), vite build. Non testé :
scénario réel navigateur (pose d'une porte, modèle 3D). Détail complet : docs/JOURNAL8.md.

Hors périmètre, non traité : reconstruire modelGlbUrl depuis modelBuiltinKey côté serveur (2e piste
du ticket d'origine) — pas nécessaire pour fermer la vulnérabilité, la validation suffit ; resterait
pertinent uniquement si le champ doit un jour rester synchronisé avec le catalogue après coup.`

async function run() {
  const code = 'CONNECTOR-MODEL-URL-ABSOLUTE'
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
