// Script à usage unique — clôture le ticket BETA-38 « Fiche personnage — onglet Matériel long à
// charger ». Déjà corrigé et validé, jamais reflété en base (découvert en reprenant ce ticket pour
// correction le 2026-10-13, audit de synchronisation déclenché dans la foulée).
// Commit 6e0c15e8 (2026-09-15) : CharacterSheet.jsx — cascade séquentielle (advantages → mutations →
// wounds+inventory) remplacée par un lancement en parallèle (aucune dépendance réelle entre ces
// requêtes). ArmorWoundPanel.jsx — refetch inutile à chaque montage supprimé au profit d'une lecture
// directe du store (patron useInventoryData.js). "Validé jeu réel par Saar (instantané)." (message du commit).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_beta38.js

import db from '../db/knex.js'

const CODE = 'BETA-38'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, correctif déjà en place (audit de synchronisation tickets) ---\n' +
    'Commit 6e0c15e8 (2026-09-15) : cascade séquentielle de CharacterSheet.jsx parallélisée, refetch ' +
    'inutile de ArmorWoundPanel.jsx supprimé au profit du store (patron useInventoryData.js). ' +
    '"Validé jeu réel par Saar (instantané)" (message du commit) — jamais répercuté sur ce ticket, ' +
    'resté triaged par oubli. C\'est cet oubli, découvert en reprenant le ticket, qui a déclenché ' +
    'un audit complet des tickets ouverts contre les commits déjà passés (2026-10-13).'

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
