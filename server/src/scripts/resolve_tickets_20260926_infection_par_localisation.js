// Script à usage unique — clôture le ticket de l'infection VALIDÉ par Saar en réel (2026-09-26, « test validé », Lot B1 de PLAN_GUERISON_RAW.md). Un ticket n'est ajouté à
// CLOSURES qu'après la validation de Saar (« fermer une règle de jeu exige une validation de Saar », AGENTS.md § Clôture).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_tickets_20260926_infection_par_localisation.js
// Écrit dans la base locale (`bug_tickets` uniquement) — à lancer par Saar. Idempotent : un ticket déjà résolu est laissé tel quel.

import db from '../db/knex.js'

const CLOSURES = [
  {
    code: 'ECHEANCE-SPAWN-UNDO',
    note:
      'Corrigé pour l\'infection et validé en jeu par Saar le 2026-09-26 (Lot B1 de PLAN_GUERISON_RAW.md) : le handler de guérison n\'« engendre » plus d\'échéance d\'infection, il assure celle de la localisation ' +
      '(ensureLocationInfection, woundHealingSchedule.js) et journalise la création (previousValues null) ou la fusion (ligne d\'origine) dans ses undoEntries : annuler l\'avance de temps la retire ou la restaure. ' +
      'Une infection appartient désormais à un personnage et une localisation (un seul Test par localisation, index unique uq_game_echeances_infection_per_location, migrations 365-366).',
  },
]

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  for (const { code, note } of CLOSURES) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`Ticket ${code} introuvable — ignoré.`); continue }
    if (ticket.status === 'resolved') { console.log(`Ticket ${code} déjà résolu.`); continue }

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
    console.log(`Ticket ${code} (id=${updated.id}) -> ${updated.status}`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
