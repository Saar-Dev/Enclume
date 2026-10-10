// Script à usage unique — clôture WORLD-COMPILE-SUPERLINEAR.
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_world_compile_superlinear.js

import db from '../db/knex.js'

const CODE = 'WORLD-COMPILE-SUPERLINEAR'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouve.')

  const note =
    'Clos 2026-10-10, trois correctifs distincts sous ce meme ticket. (1) Identite de rendu : ' +
    'SurfaceDungeonScene.jsx reconstruisait un objet salle/connecteur neuf en JSX a chaque rendu, ' +
    'cassant la memoisation interne de CurvedRoomSlab/DoorConnectorModel (clonage GLTF et geometrie ' +
    'refaits sans raison) - corrige par cache roomsById/connectorsById (commit 0e271ffd, confirme en ' +
    'jeu). (2) Memoisation shared/world/roomGeometry.js : roomBoundaryMultiPolygon (contour de salle) ' +
    'etait recalcule une fois par case testee au lieu d\'une fois par salle - WeakMap a deux niveaux ' +
    '(room -> roomLookup), mesure x954 sur une salle de 400 cases, adresse directement le titre ' +
    'original du ticket (compileSurfaceWorld couteux sur une salle 50x50 a chaque sauvegarde editeur). ' +
    'client/src/lib/voxelTextures.js : chargement des textures d\'une carte en parallele (Promise.all) ' +
    'au lieu d\'une requete reseau par texture en serie. (3) Trou de chargement 20-44s au premier ' +
    'chargement d\'un navigateur neuf : enquete conclue PAS UN BUG APPLICATIF. Elimine un par un, ' +
    'chaque piste testee en isolation sur les vraies donnees avant d\'etre ecartee : connexion ' +
    'localhost/127.0.0.1 (aucun effet), getBucketRegionAsync de la lib minio (16ms, pas 19s), ' +
    'compileSurfaceWorld sur la vraie carte (203ms, pas 19s), chemin complet statObject+getObject ' +
    'd\'assets.js sequentiel ET concurrent (sous 100ms). Preuve decisive trouvee dans une trace Firefox ' +
    'Profiler fournie par Saar : les requetes reseau reelles (DNS+connexion+reponse+telechargement) ' +
    'prennent 234ms, mais le navigateur ne marque la requete terminee (STATUS_STOP) que 20,5s apres ' +
    '- confirme independamment par le marqueur natif LargestContentfulPaint (23691ms) sur l\'image ' +
    'concernee. Confirme par Saar : le trou disparait en mode sans extensions Firefox et avec un ' +
    'autre navigateur sans extension - cause reelle = extension(s) du profil Firefox de test ' +
    '(Adblock Plus, Privacy Badger, LeechBlock NG et al., 18 extensions actives dans la trace). ' +
    'Detail complet : docs/JOURNAL8.md sessions du 2026-10-08 et 2026-10-10.'

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
