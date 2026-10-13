// Script à usage unique — note de progression COMBAT-STALE-CONFIRM-MESSAGE-I18N : correctif codé,
// scénario réel restant à valider par Saar avant clôture (nécessite une vraie course multi-clients).
// Détail complet : JOURNAL8.md, session du 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_combat_stale_confirm_message_i18n.js

import db from '../db/knex.js'

const CODE = 'COMBAT-STALE-CONFIRM-MESSAGE-I18N'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Le message « L'ordre a changé entre-temps... » (socketCombatResolution.js, race légitime à la " +
    'confirmation d\'une fenêtre de modificateurs) était codé en dur en français côté serveur ' +
    '(infraction i18n) et jugé incompréhensible par Saar. Corrigé : reformulé en clair (« Le tour ' +
    "est passé à X pendant que vous prépariez votre action... »), déplacé vers deux clés i18n " +
    "dédiées (session.staleConfirmNextTurn/staleConfirmTurnOver). useCombatSocket.js résout " +
    "désormais i18nKey+params en priorité, repli sur message brut pour les très nombreux autres " +
    "sites de COMBAT_DECLARE_ERROR (dette ancienne et répandue, pas migrée ici, hors périmètre). " +
    "Question annexe du ticket (pourquoi la fenêtre ne se ferme pas seule) non investiguée, " +
    'amélioration séparée. Testé : JSON valide, ESLint (0 nouveau problème), node --check, build ' +
    'client propre. Non testé : aucun test automatisé n\'exerce cette course (scénario réel ' +
    'multi-clients requis).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel multi-clients non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
