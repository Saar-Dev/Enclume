// Script à usage unique — clôture le ticket RELOAD-INHAND « Rechargement sans vérification en
// main ». Déjà corrigé et validé, jamais reflété en base (audit 2026-10-13).
// Commit 1cd77c5d (2026-09-15) : le chemin weapon_inv_id explicite faisait une requête brute sans
// vérifier char_inventory_slots — remplacé par getOwnedHandWeapon (ownership + en-main), même
// autorité que MELEE-INHAND/ASSAULT-INHAND-RESOLUTION. "Validé jeu réel par Saar." (message du
// commit, partagé avec ASSAULT-CATEGORY).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_reload_inhand.js

import db from '../db/knex.js'

const CODE = 'RELOAD-INHAND'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, correctif déjà en place (audit de synchronisation tickets) ---\n' +
    'Commit 1cd77c5d (2026-09-15) : getOwnedHandWeapon remplace la requête brute sur weapon_inv_id ' +
    '(ownership + en-main vérifiés). "Validé jeu réel par Saar" (message du commit) — jamais ' +
    'répercuté sur ce ticket, resté triaged par oubli.'

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
