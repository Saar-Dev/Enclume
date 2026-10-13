// Script à usage unique — note de progression STATUT-EXO-PILOTE-PARITE : correctif codé, scénario
// réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_statut_exo_pilote_parite.js

import db from '../db/knex.js'

const CODE = 'STATUT-EXO-PILOTE-PARITE'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    'Décision de Saar : une exo-armure dont le pilote est inconscient ou mort ne peut plus agir ' +
    "(confirmé par le livre : l'équipement « Autopilote », qui ramène l'exo à la base si le pilote " +
    "est inconscient, n'aurait aucun sens si c'était déjà le comportement par défaut). " +
    'getDeclarationBlockedTokens (combatTurnEngine.js) ne lisait que les statuts du token qui agit ' +
    "(l'exo elle-même), jamais ceux du pilote sur son propre token. Corrigé : résolution groupée du " +
    "pilote (exo_sheet.pilot_character_id) et de son token sur la même carte — si le pilote porte un " +
    "statut bloquant (ou un étourdissement en attente), l'exo est marquée bloquée avec le même " +
    "statut, même sans statut propre. Deux requêtes groupées pour l'ensemble des tokens vérifiés, " +
    'jamais une par exo. Testé : node --env-file=.env --test server/src/socket/combatTurnEngine.test.mjs ' +
    '(44/44, nouveau test dédié, aucune régression), shared/**/*.test.mjs (947/947), node --check. ' +
    'Aucun fichier client touché. Non testé : scénario réel navigateur — faire perdre connaissance ' +
    "au pilote d'une exo en combat, confirmer que l'exo n'est plus proposée à l'action."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (DB-backed), scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
