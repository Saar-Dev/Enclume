// Script à usage unique — passe WIZ45 en in_progress après correctif (5 Step*.jsx du Wizard,
// docs/JOURNAL8.md, 2026-08-22). Pas 'resolved' : le scénario réel navigateur (Précédent/stepper
// sans "Suivant", puis vérification Step7/finalisation) reste à valider par Saar. Lancement manuel :
// node --env-file=.env server/src/scripts/mark_ticket_wiz45_coded.js

import db from '../db/knex.js'

const CODE = 'WIZ45'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'in_progress' || ticket.status === 'resolved') {
    console.log(`Ticket ${CODE} déjà ${ticket.status}, rien à faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const fixNote =
    'Codé 2026-08-22 : cause racine plus large que le ticket ne le décrivait (seul "Suivant" ' +
    'committait stepNData au store — Précédent/stepper abandonnaient silencieusement toute édition ' +
    'locale). Corrigé en généralisant à toutes les étapes le commit continu déjà partiellement en ' +
    'place (pcSpent Step1, liveYears Step4) : Step1Attributes.jsx, Step2Genotype.jsx, ' +
    'Step3Mutations.jsx (mutationsMeta ajouté), Step4Experience.jsx, Step5Advantages.jsx (pcNet/' +
    'advantagesMeta ajoutés). Détail complet docs/JOURNAL8.md, session 2026-08-22 ' +
    '"Tri des tickets migrés en clusters + WIZ45". Lint + build client OK. Non testé : scénario ' +
    'réel navigateur (édition non validée puis navigation arrière, vérifier Step7/finalisation).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${fixNote}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
