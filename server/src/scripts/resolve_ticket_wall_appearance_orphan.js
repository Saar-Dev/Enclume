// Script à usage unique — ticket WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN.
// Trouvé le 2026-10-14 (status=new, aucune note), corrigé en code le 2026-10-15 par Saar lui-même
// (commit 746f9fd0, PLAN_DECALS Lot 1) en passant : deleteRoomBoundaryWalls applique désormais
// prunedByRetainedEdges() à wallElevationProfiles/wallAppearanceProfiles dans la branche
// ownerIds.length === 1 (mur ouvert vers l'extérieur), au même titre que openWallEdgeKeys.
// [VÉRIFIÉ] client/src/lib/surfaceRooms.js:711-715 ; test de régression dédié
// "ouvrir un mur vers l'extérieur supprime le décor et ne laisse pas d'apparence orpheline"
// (client/src/lib/surfaceData.test.mjs:1317-1335, assertion portant le nom du ticket) — relancé :
// 61/61 verts. Idempotent (MARKER en note). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/resolve_ticket_wall_appearance_orphan.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : vérifié par lecture du code réel + test de régression dédié relancé (61/61 verts) ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const t = await db('bug_tickets').where({ linked_bug_code: 'WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }

  const note = `${MARKER}\nCorrigé par Saar le 2026-10-15 en passant, commit 746f9fd0 (PLAN_DECALS Lot 1) : deleteRoomBoundaryWalls (client/src/lib/surfaceRooms.js:698-736) applique désormais prunedByRetainedEdges() à wallElevationProfiles ET wallAppearanceProfiles dans la branche ownerIds.length === 1 (mur ouvert vers l'extérieur), exactement la piste proposée dans ce ticket. Test de régression dédié déjà présent et vert : surfaceData.test.mjs:1317-1335 ("ouvrir un mur vers l'extérieur supprime le décor et ne laisse pas d'apparence orpheline", assertion message "régression WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN"). Relancé ce jour : 61/61 tests verts sur surfaceData.test.mjs. Data hygiene pure (aucun comportement visuel/règle de jeu) — clôturé sur preuve de code + test, sans validation live requise.`

  await db('bug_tickets').where({ id: t.id }).update({
    status: 'resolved',
    reviewed_by: admin.id,
    reviewed_at: db.fn.now(),
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN -> resolved')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
