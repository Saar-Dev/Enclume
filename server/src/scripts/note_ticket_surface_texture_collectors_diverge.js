// Script à usage unique — note de progression SURFACE-TEXTURE-COLLECTORS-DIVERGE : correctif codé,
// scénario réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md,
// session du 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_surface_texture_collectors_diverge.js

import db from '../db/knex.js'

const CODE = 'SURFACE-TEXTURE-COLLECTORS-DIVERGE'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "collectSurfaceTextureIds (shared/world/surfaceDocument.js, serveur + export de carte) et " +
    "surfaceTextureIds (client/src/lib/surfaceData.js) étaient deux copies quasi identiques de la " +
    "même règle « quels champs sont des textures » — la copie client n'avait pas la boucle " +
    'room.wallAppearanceProfiles[].interiorTex : une texture référencée uniquement par un profil ' +
    "d'apparence de mur n'était jamais chargée en mode jeu. Pas d'unification des deux normaliseurs " +
    "(normalizeSurfaceDataDocument partagé vs normalizeSurfaceData client) — hors périmètre, les " +
    'deux produisent déjà la même forme pour ces champs. Corrigé : la marche extraite dans une ' +
    'fonction pure partagée addSurfaceTextureIds(surface, ids), appelée par les deux après leur ' +
    'propre normalisation. Le 3ᵉ consommateur cité par le ticket (export de carte, ' +
    'battlemapWorldPersistence.js) utilisait déjà la version partagée, pas affecté. Testé : node ' +
    '--test shared/world/surfaceDocument.test.mjs (19/19, cas wallAppearanceProfiles déjà existant, ' +
    'aucune régression), ESLint (0 problème), build client propre, node --check. Non testé : ' +
    "scénario réel navigateur — poser un mur avec un profil d'apparence intérieure distinct, " +
    'confirmer que sa texture charge en mode jeu.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (pur), scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
