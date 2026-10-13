// Script à usage unique — note de progression GAMETIME-WIDGET-SWALLOWS-ERRORS : correctif codé,
// scénario réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md,
// session du 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_gametime_widget_swallows_errors.js

import db from '../db/knex.js'

const CODE = 'GAMETIME-WIDGET-SWALLOWS-ERRORS'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "GameTimeWidget.jsx (adjust) n'écrivait un refus serveur (POST game-time/request-advance, ex. " +
    '409 « avance déjà en attente », bornes dépassées) que dans console.error. Corrigé : même ' +
    "patron que l'erreur transitoire de DroneWindow.jsx (ordersError/ordersErrorTimerRef, " +
    "auto-disparition après 4 s, cleanup au démontage) — error affiché sous la pastille horloge " +
    '(.gametime-error, var(--color-danger-soft)). extractErrorMessage(err, t) (résolution i18nKey ' +
    "serveur sinon message brut) extraite de WizardCreation.jsx (seul appelant jusqu'ici) vers " +
    'client/src/lib/apiError.js (nouveau), pour ne pas dupliquer cette logique dans un second ' +
    'composant — WizardCreation.jsx importe désormais depuis ce fichier, comportement inchangé. ' +
    'Testé : ESLint (0 nouveau problème), build client propre. Non testé : scénario réel navigateur ' +
    '— aucun test automatisé possible (pas de suite de tests composant React dans ce projet) ; ' +
    'vérifier en déclenchant un refus serveur (ex. redemander une avance alors qu\'une est déjà en ' +
    'attente de revue) que le message apparaît sous l\'horloge puis disparaît après 4 s.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
