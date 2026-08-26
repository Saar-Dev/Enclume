// Script à usage unique — crée un ticket pour la machinerie de sauvegarde voxel désormais
// définitivement inerte, trouvée en traitant bug_tickets/AUDIT-SYSTEME (2026-08-26). Faute corrigée
// ici (« soit tu corriges soit tu notes », Saar) : hors périmètre du ticket traité (émissions
// WS no-op), garder trace plutôt que mentionner sans suite. Lancement manuel :
// node --env-file=.env server/src/scripts/create_ticket_voxel_save_pipeline_inert.js

import db from '../db/knex.js'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: 'VOXEL-SAVE-INERT1' }).first()
  if (existing) {
    console.log('Ticket déjà présent, rien à faire.')
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const [ticket] = await db('bug_tickets')
    .insert({
      reporter_id: admin.id,
      origin: 'admin',
      category: 'other',
      domain: 'editeur',
      title: 'Editor3D.jsx : pipeline de sauvegarde voxel (REST PUT /battlemaps/:id/voxels) définitivement inatteignable',
      description:
        'Trouvé en traitant bug_tickets/AUDIT-SYSTEME (VOXEL_ADD/REMOVE/UPDATE no-op) : la fonction ' +
        'EditorScene (Editor3D.jsx) qui posait/effaçait/tournait des voxels était déjà, avant ce ' +
        'ticket, jamais rendue dans l\'arbre JSX (docs/SYSTEME/EDITEUR.md §1, audit 2026-08-26) — ' +
        'elle vient d\'être supprimée comme code mort. Or c\'était la SEULE fonction qui mettait ' +
        '`isDirty.current = true` sur le voxel dirty flag du composant principal Editor3D. ' +
        'Conséquence vérifiée : l\'auto-save toutes les 60s et la sauvegarde au démontage (§4.3/4.4 ' +
        'EDITEUR.md), qui ne se déclenchent que si `isDirty.current`, ne peuvent plus jamais se ' +
        'déclencher — `voxelSaveQueueRef`/`voxelSaveRevisionRef` et la route serveur ' +
        '`PUT /battlemaps/:id/voxels` (battlemaps.js) restent en place mais ne seront plus jamais ' +
        'appelés par un utilisateur normal, plus aucun chemin UI ne peut modifier `voxels`. ' +
        'Séparé du ticket AUDIT-SYSTEME (autre nature : pas des émissions WS orphelines mais tout ' +
        'un chemin de sauvegarde REST devenu mort) et volontairement non traité ici — décider si ce ' +
        'pipeline doit être retiré entièrement (avec sa route) ou si un usage futur (script admin, ' +
        'réédition voxel) le justifie encore, avant de le supprimer. Le chargement en lecture seule ' +
        'de voxel_data (`CulledVoxelScene`, fallback cartes sans surface_data) n\'est pas concerné, ' +
        'il ne dépend pas de ce pipeline de sauvegarde.',
      linked_bug_code: 'VOXEL-SAVE-INERT1',
      status: 'new',
      priority: 'low',
      admin_notes: 'Trouvé en corrigeant bug_tickets/AUDIT-SYSTEME — hors périmètre de ce ticket-là.',
    })
    .returning(['id'])

  console.log(`Ticket créé : ${ticket.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
