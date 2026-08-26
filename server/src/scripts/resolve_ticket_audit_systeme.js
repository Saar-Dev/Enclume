// Script à usage unique — passe AUDIT-SYSTEME en in_progress après correctif (Editor3D.jsx,
// shared/events.js, server/src/socket/socketBattlemap.js+index.js, 2026-08-26). Pas 'resolved' : le
// scénario réel navigateur à deux sessions (GM + joueur, "Déplacer le groupe") reste à valider par
// Saar. Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_audit_systeme.js

import db from '../db/knex.js'

const CLUSTER = 'AUDIT-SYSTEME'

async function run() {
  const ticket = await db('bug_tickets').where({ cluster_label: CLUSTER }).first()
  if (!ticket) throw new Error(`Ticket cluster ${CLUSTER} introuvable.`)
  if (ticket.status === 'in_progress' || ticket.status === 'resolved') {
    console.log(`Ticket cluster ${CLUSTER} déjà ${ticket.status}, rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Corrigé 2026-08-26 — traité en deux volets distincts, vérifiés séparément :\n' +
    '- VOXEL_ADD/REMOVE/UPDATE (+ VOXEL_ADDED/REMOVED/UPDATED) : l\'unique émetteur (EditorScene, ' +
    'fonction locale à Editor3D.jsx) n\'était lui-même jamais rendu dans l\'arbre JSX — code mort des ' +
    'deux côtés, pas seulement côté serveur. Supprimé : fonction EditorScene + helpers exclusifs ' +
    '(ROOM_DEFAULTS, getVoxelKey, clampInt, normalizeRoomSelection, buildRoomVoxels, ' +
    'RoomSelectionGhost, GhostVoxel) + import Voxel/useFrame devenus inutilisés + les 6 constantes ' +
    'VOXEL_* de shared/events.js. Plus aucune trace nulle part (client ni serveur).\n' +
    '- MAP_SWITCH : émetteur réel et atteignable (useBattlemapManager.js:handleMapSwitch, bouton GM ' +
    '"Déplacer le groupe") et auditeur client déjà en place (useEntitySocket.js:onMapSwitch) — seul ' +
    'le relai serveur manquait. Handler recréé dans server/src/socket/socketBattlemap.js ' +
    '(registerBattlemapHandlers) : vérifie isGm + appartenance du battlemap à la campagne, puis ' +
    'relaie aux autres membres (socket.to(campaignId), le GM a déjà rafraîchi sa propre vue en ' +
    'REST). Enregistré dans index.js aux côtés des autres register*.\n' +
    '- MAP_VIEWPORT : vérifié — aucune émission ni écoute nulle part (ni client ni serveur), ' +
    'contrairement à ce que le titre du ticket laissait supposer. Constante déclarée et jamais ' +
    'utilisée, rien à corriger.\n' +
    'Documentation à jour : docs/SYSTEME/CORE.md, ARCHITECTURE_SOCKET.md, EDITEUR.md, VOXELS.md, ' +
    'CONVENTIONS.md (P12 retiré). Trouvaille annexe (pipeline de sauvegarde voxel REST devenu ' +
    'inatteignable, hors périmètre) : ticket bug_tickets/VOXEL-SAVE-INERT1.\n' +
    'Testé : lint client (0 erreur), build client complet (succès), import du graphe de modules ' +
    'socket serveur (succès, y compris socketBattlemap.js). Non testé : scénario navigateur réel ' +
    'à deux sessions (GM + joueur) confirmant que "Déplacer le groupe" fait bien suivre le joueur — ' +
    'nécessite une validation manuelle de Saar.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${fixNote}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket cluster ${CLUSTER} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
