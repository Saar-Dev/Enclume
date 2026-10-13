// Script à usage unique — note de progression STATUT-STUN-PROMPT-ORPHELIN-MORT : correctif codé,
// scénario réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md,
// session du 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_statut_stun_prompt_orphelin_mort.js

import db from '../db/knex.js'

const CODE = 'STATUT-STUN-PROMPT-ORPHELIN-MORT'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Si un joueur a une fenêtre « durée d'étourdissement » (COMBAT_STUN_PROMPT) ouverte quand son " +
    "personnage est marqué Mort, applyDeathConsequences supprimait déjà la ligne combat_pending " +
    "'stun' mais rien ne fermait la fenêtre côté client. TOKEN_STATUS_UPDATED seul ne convient pas " +
    "(il arrive aussi pour un changement de statut sans rapport sur le même token, fermerait à tort " +
    "un prompt légitime). Corrigé : nouvel événement dédié COMBAT_STUN_PROMPT_CANCEL " +
    "(shared/events.js), émis par applyDeathConsequences (statusService.js) uniquement pour les " +
    "tokens dont la ligne combat_pending 'stun' vient d'être retirée ; useCombatSocket.js ferme " +
    'stunPayload seulement si le tokenId correspond exactement au prompt affiché. Testé : node ' +
    '--env-file=.env --test server/src/lib/deathStateService.test.mjs (8/8, aucune régression), ' +
    'ESLint (0 nouveau problème), build client propre, node --check serveur. Non testé : scénario ' +
    'réel navigateur, aucun test automatisé possible pour la fermeture de fenêtre elle-même — ' +
    "ouvrir une fenêtre de durée d'étourdissement, faire mourir le personnage entre-temps (MJ), " +
    "confirmer qu'elle se ferme d'elle-même côté joueur."

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
