// Script à usage unique — note de progression COM24 « Bonus "deux armes" (+3 CaC) déconnecté de
// l'arme réellement déclarée ». Déjà corrigé, jamais reflété en base (audit 2026-10-13).
// Commit 42298070 (Session 176, 2026-07-25) : mécanisme "deux armes" à la déclaration ajouté, miroir
// exact du dual-wield Tir déjà existant, shared/weaponSlots.js réutilisé tel quel, revalidation
// serveur déclaration+résolution, 7 fichiers (docs/BUGIDENTIFIE.md de ce commit : "COM24 clos ...
// non testé en jeu"). Reste in_progress tant que la validation en jeu n'est pas confirmée.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_com24.js

import db from '../db/knex.js'

const CODE = 'COM24'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif déjà en place, jamais reflété (audit de synchronisation tickets) ---\n' +
    'Commit 42298070 (Session 176, 2026-07-25) : mécanisme "deux armes" à la déclaration CaC ajouté, ' +
    'miroir du dual-wield Tir existant (shared/weaponSlots.js réutilisé tel quel), 7 fichiers. ' +
    'docs/BUGIDENTIFIE.md de ce même commit : "COM24 clos ... non testé en jeu" — reste in_progress ' +
    'tant que cette validation n\'est pas confirmée.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
