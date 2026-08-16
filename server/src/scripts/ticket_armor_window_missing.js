// Script à usage unique (patron importBugIdentifie.js) — trouvé en construisant VaultCharacterPage
// (chantier Coffre, docs/EN_COURS.md 2026-08-16), mais gap préexistant à tout le projet, pas propre
// au Coffre : SessionPage.jsx:257 "Extensible : ajouter un case 'armure' quand ArmorWindow sera
// implémentée" — jamais construite. Idempotent via linked_bug_code.
//
// Lancement manuel : node --env-file=.env server/src/scripts/ticket_armor_window_missing.js

import db from '../db/knex.js'

const CODE = 'ARMORWINDOW-MISSING1'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first('id')
  if (existing) {
    console.log(`Ticket ${CODE} déjà présent (id=${existing.id}) — rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const [ticket] = await db('bug_tickets').insert({
    reporter_id: admin.id,
    origin: 'admin',
    category: 'bug',
    linked_bug_code: CODE,
    domain: 'personnage',
    title: 'ArmorWindow (fiche exo-armure) jamais construite — un exo ouvre la fenêtre PJ, fausse',
    description:
      'SessionPage.jsx:openSheet (dispatcher centralisé qui route vers la bonne fenêtre selon ' +
      'character.type) n\'a que deux cas : "drone" → DroneWindow, "default" → CharacterWindow. Le ' +
      'commentaire du code l\'anticipe explicitement : "Extensible : ajouter un case \'armure\' ' +
      'quand ArmorWindow sera implémentée" — jamais fait. Un personnage type=\'exo\' tombe donc sur ' +
      'CharacterWindow (fiche char_sheet : identité, attributs, compétences...), qui n\'a aucun sens ' +
      'pour une exo-armure (pas de char_sheet du tout, sa fiche est exo_sheet — intégrité, avaries, ' +
      'systèmes, pilote). Probablement jamais remarqué car aucune exo-armure n\'avait encore été ' +
      'créée puis ouverte en pratique (le triptyque pnj/drone/exo n\'a toujours été qu\'un mécanisme ' +
      'de création, cf. characters.js — PLAN_EXOARMURE.md porte sur le contenu de la fiche une fois ' +
      'créée, pas sur son édition manuelle). Trouvé en construisant VaultCharacterPage.jsx (chantier ' +
      'Coffre) : contournement appliqué là-bas (message explicite "pas encore construit" au lieu ' +
      'd\'afficher la fausse fiche PJ) — SessionPage.jsx (contexte campagne) a toujours le même défaut, ' +
      'non corrigé, hors périmètre du Coffre.',
    status: 'triaged',
    priority: 'medium',
    cluster_label: 'Exo-armure',
    admin_notes:
      'Corrélé à PLAN_EXOARMURE.md (chantier actif, mécaniques de combat). Construire ArmorWindow ' +
      '(mirroir de DroneWindow.jsx : intégrité par palier, avaries, systèmes équipés, assignation de ' +
      'pilote) est un chantier à part entière, pas un correctif ponctuel.',
  }).returning(['id'])

  console.log(`Ticket ${CODE} créé (id=${ticket.id}).`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
