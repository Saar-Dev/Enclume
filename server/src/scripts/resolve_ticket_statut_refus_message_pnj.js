// Script à usage unique — clôture le ticket STATUT-REFUS-MESSAGE-PNJ « Message de refus affiché même
// quand le MJ déclare pour un PNJ ». Détail complet : JOURNAL8.md, session du 2026-10-13.
// Décision de Saar (2026-10-13) : clôturer sans scénario réel dédié (course trop rare pour la
// provoquer volontairement en test).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_statut_refus_message_pnj.js

import db from '../db/knex.js'

const CODE = 'STATUT-REFUS-MESSAGE-PNJ'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, décision de Saar (sans scénario réel dédié) ---\n' +
    "Les deux gardes STUN2 (socketCombatResolution.js, filets PRECHECK et CONFIRM) composaient le " +
    'message de refus avec « vous êtes {{statut}} » sans savoir si l\'acteur bloqué était le joueur ' +
    'lui-même ou un PNJ que le MJ venait de faire agir. Corrigé : isOwnToken (!isGm) et actorLabel ' +
    'ajoutés au payload COMBAT_DECLARE_ERROR des deux gardes ; nouvelle clé i18n ' +
    'session.stun_blocked_other (« Action impossible pour {{label}} — statut : {{statut}} ») ' +
    'utilisée quand isOwnToken===false, session.stun_blocked_self (ex-stun_blocked, texte inchangé) ' +
    'sinon. Testé : JSON valide, ESLint (0 nouveau problème), build client propre, node --check ' +
    "serveur. Course trop rare (entre le choix du pas et le clic) pour un scénario réel simple — " +
    "Saar a choisi de clôturer sans validation dédiée plutôt que d'attendre une occurrence."

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

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
