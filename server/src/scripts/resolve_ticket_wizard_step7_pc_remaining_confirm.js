// Script à usage unique — clôture du ticket sans linked_bug_code (id ci-dessous) : "Step7 : pas de
// pop-up de confirmation si des Points de Création restent non dépensés à la finalisation".
// Trouvé le 2026-10-14 déjà résolu : la fenêtre WizardFinalizeConfirm.jsx (Revenir / Terminer quand
// même) existe depuis le commit acfbabe9 (2026-09-24), jamais refermé dans la base depuis. Saar
// confirme la fonctionnalité déjà vue en usage (en prod depuis 3 semaines) — clôture directe en
// résolu, sans nouveau test ce jour. Détail : JOURNAL8.md, session du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_wizard_step7_pc_remaining_confirm.js

import db from '../db/knex.js'

const TICKET_ID = '4f311941-2b6d-4d80-a93f-e0a6b092d5ca'

async function run() {
  const ticket = await db('bug_tickets').where({ id: TICKET_ID }).first()
  if (!ticket) throw new Error(`Ticket ${TICKET_ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : clôture (déjà résolu) ---\n' +
    'Trouvé déjà implémenté en explorant ce ticket : WizardFinalizeConfirm.jsx (fenêtre "Revenir" / ' +
    '"Terminer quand même", fermable par Échap) existe et est câblée dans WizardCreation.jsx depuis le ' +
    'commit acfbabe9 (2026-09-24) — en production depuis 3 semaines. Le ticket avait simplement été ' +
    "oublié dans la base. Saar confirme avoir déjà vu cette fenêtre fonctionner en jeu — clôturé " +
    'directement en résolu, sans nouveau test ce jour.'

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
