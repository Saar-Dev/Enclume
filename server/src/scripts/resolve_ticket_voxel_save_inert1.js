// Script à usage unique — clôture le ticket « Editor3D.jsx : pipeline de sauvegarde voxel (REST PUT
// /battlemaps/:id/voxels) définitivement inatteignable » (VOXEL-SAVE-INERT1, trouvé 2026-08-26).
// Décision de Saar (chantier Purge Voxel, docs/PLANS/PLAN_PURGE_VOXEL.md, Q2 du 2026-10-13) : migration
// destructive prévue pour les colonnes voxel, pas de ré-édition voxel future — le ticket laissait
// explicitement cette question ouverte avant de retirer le pipeline, elle est maintenant tranchée.
// Lot 2 codé le 2026-10-14 : route PUT /:id/voxels (server/src/routes/battlemaps.js), saveVoxelsFireAndForget/
// voxelSaveQueueRef/voxelSaveRevisionRef/isDirty (client/src/legacyVoxel/useLegacyVoxelState.js) retirés ;
// voxel_revision retiré de BATTLEMAP_DOCUMENT_REVISION_COLUMNS (battlemapWorldPersistence.js) et du test
// correspondant. Vérifié avant retrait (analyse à charge, pas supposé) : zéro appelant client restant
// (recherche globale sur /voxels), isDirty jamais mis à true nulle part. node --check serveur propre,
// eslint client propre (0 nouvelle erreur/warning), test battlemapWorldPersistence.test.mjs vert (3/3),
// build client propre. Le chargement en lecture seule de voxel_data (voxels, repli de rendu sur carte
// sans surface_data) n'est PAS concerné par ce lot — catégorie B du plan, Lot 3 à venir.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_voxel_save_inert1.js

import db from '../db/knex.js'

const ID = '9a3f2ff1-fa3f-4352-8b92-1e0a74cbd90a'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : clôturé, Lot 2 PLAN_PURGE_VOXEL.md codé ---\n' +
    'Décision de Saar (2026-10-13, Q2 du cadrage) : migration destructive prévue pour les colonnes ' +
    'voxel, aucun usage futur (script admin, ré-édition) à préserver -- la question laissée ouverte par ' +
    "ce ticket est tranchée. Pipeline retiré en entier : route PUT /:id/voxels, saveVoxelsFireAndForget/" +
    'voxelSaveQueueRef/voxelSaveRevisionRef/isDirty, voxel_revision retiré de ' +
    'BATTLEMAP_DOCUMENT_REVISION_COLUMNS. Le chargement en lecture seule de voxel_data (fallback de rendu ' +
    'sur carte sans surface_data) reste en place, non concerné -- Lot 3 à venir, docs/PLANS/' +
    'PLAN_PURGE_VOXEL.md.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
