// Script à usage unique — clôture les tickets de la règle des cases VALIDÉS par Saar en réel (2026-09-26, « Test ok »). Un ticket n'est ajouté à
// CLOSURES qu'après la validation de Saar (« fermer une règle de jeu exige une validation de Saar », AGENTS.md § Clôture).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_tickets_20260926_regle_des_cases.js
// Écrit dans la base locale (`bug_tickets` uniquement) — à lancer par Saar. Idempotent : un ticket déjà résolu est laissé tel quel.

import db from '../db/knex.js'

const CLOSURES = [
  {
    code: 'WOUND-HEAL-LINE-CAPACITY',
    note:
      'Corrigé et validé en jeu par Saar le 2026-09-26 (Lot A de PLAN_GUERISON_RAW.md) : resolveWoundImprovement ne contient plus de cascade ; il supprime la case d\'origine puis pose la case ' +
      'obtenue par resolveWoundInsertion (règle des cases du livre, REGLEBLESSURES.md:47-53) : une ligne d\'arrivée pleine est effacée et la case est cochée au-dessus, sans jamais dépasser la ' +
      'gravité d\'origine (plafond). Une ligne ne dépasse plus sa capacité.',
  },
  {
    code: 'WOUND-FULL-LINE-TWO-CONVENTIONS',
    note:
      'Corrigé et validé en jeu par Saar le 2026-09-26 (Lot A de PLAN_GUERISON_RAW.md) : une seule définition de « ligne pleine », isWoundLineFull (shared/woundConstants.js) — toutes les cases ' +
      'cochées, la blessure SUIVANTE convertit — lue par la pose d\'une blessure (coup, guérison, infection) et par la Chance (hasSeverityRoom). L\'ancienne lecture (la case qui remplirait la ' +
      'dernière convertit, exception Mortelle) est retirée : le livre fait autorité. Décision de Saar : JOURNAL8.md, 2026-09-26. Suite : EXO-AVARIE-LINE-CONVENTION (compteur d\'Avaries des exo-armures).',
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
