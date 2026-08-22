// Script à usage unique — clôture ADV3, ticket périmé : vérifié dans creationService.js avant
// clôture. Les compétences ET mutations accordées automatiquement par tirage de carrière (Lot 2,
// ref_career_random_benefits) sont déjà entièrement câblées : blockResult.grantedSkills fusionné dans
// careersCtx (réinjecté dans char_skills à la réconciliation STEP4), characterEffectTotals.
// grantedMutations appliqué via addMutation(sheetId, mutation_id, subtype_id, 'revers', trx) dans la
// même transaction. Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_adv3.js

import db from '../db/knex.js'

const CODE = 'ADV3'

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
    'Périmé, vérifié 2026-08-22 : creationService.js#reconcileCreation câble déjà entièrement les ' +
    'octrois automatiques de tirage de carrière — blockResult.grantedSkills fusionné dans careersCtx ' +
    '(réinjecté char_skills), characterEffectTotals.grantedMutations appliqué via addMutation(...,' +
    '\'revers\', trx) dans la même transaction. Aucun correctif nécessaire.'

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
