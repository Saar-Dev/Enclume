// Script à usage unique — clôture CS5, ticket périmé : vérifié dans le code avant clôture.
// POST /api/char-sheet/:characterId/skills/buy (char-sheet.js) implémente déjà intégralement le
// mécanisme d'ouverture d'une compétence réservée (X) — coût 1 PE, mastery -> -3, is_learned -> true,
// exactement la mécanique que le ticket décrit comme manquante. Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_cs5.js

import db from '../db/knex.js'

const CODE = 'CS5'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà résolu.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Périmé, vérifié 2026-08-22 : POST /api/char-sheet/:characterId/skills/buy (char-sheet.js:549) ' +
    'implémente déjà le mécanisme complet — marker=\'(X)\' et is_learned=false → coût 1 PE, ' +
    'mastery → -3, is_learned → true. Exactement la mécanique décrite comme manquante. Aucun ' +
    'correctif nécessaire.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${fixNote}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
