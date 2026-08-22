// Script à usage unique — clôture CAR1, ticket périmé : vérifié dans le code avant clôture (pas sur
// la seule description du ticket, elle-même héritée telle quelle de docs/EN_COURS.md sans revérif au
// moment de la migration vers bug_tickets). CareersAllocator.jsx implémente déjà intégralement le
// mécanisme "au choix" (conditional:true) — commentaire du fichier lui-même le date de "Lot 5",
// chantier déjà terminé : choiceGroups (radio exclusif via choice_group, ou checkbox solo),
// rendu réel (lignes ~659-696), dispatch TOGGLE_OPENED_SKILL/SELECT_CHOICE_GROUP_SKILL, verrouillé
// tant que la carrière n'est pas ajoutée (career_choice_locked). Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_car1.js

import db from '../db/knex.js'

const CODE = 'CAR1'

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
    'Périmé, vérifié 2026-08-22 : CareersAllocator.jsx implémente déjà intégralement le mécanisme ' +
    '"au choix" (conditional:true) — choiceGroups (radio exclusif via choice_group, checkbox solo ' +
    'sinon), rendu réel et interactif, dispatch TOGGLE_OPENED_SKILL/SELECT_CHOICE_GROUP_SKILL, ' +
    'verrouillé tant que la carrière n\'est pas ajoutée. Le commentaire du fichier le date lui-même ' +
    'de "Lot 5", un chantier déjà terminé. Aucun correctif nécessaire.'

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
