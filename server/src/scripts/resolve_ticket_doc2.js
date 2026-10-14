// Script à usage unique — clôture DOC2 : REGLES_LdB.md vérifié ligne-à-ligne (100% doublon de
// REGLESYSCOMBAT.md, aucun contenu unique) puis supprimé, toutes les références mortes corrigées.
// Détail complet : JOURNAL8.md, session du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_doc2.js

import db from '../db/knex.js'

const CODE = 'DOC2'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : clôturé ---\n' +
    "Vérification ligne-à-ligne (déléguée à un agent de lecture) : 100% du contenu de REGLES_LdB.md " +
    'est une copie verbatim (mêmes chiffres, mêmes exemples) d\'une portion de REGLESYSCOMBAT.md, qui ' +
    'est la version plus complète et officielle. Aucune différence, aucun passage unique. Fichier ' +
    "supprimé. Références mortes corrigées : docs/SYSTEME/COMBAT.md, docs/MANUELS/MANUEL_BLESSURES.md " +
    "(repointées vers REGLESYSCOMBAT.md), server/src/services/movementBudgetService.js (citation RAW " +
    'vivante retrouvée et revérifiée à REGLESYSCOMBAT.md:773-780, même texte). Laissés intacts : ' +
    "docs/Old/*, migrations/scripts d'import historiques. Testé : node --check, test ciblé " +
    'movementBudgetService.test.mjs (4/4, DB réelle), recherche exhaustive de références mortes.'

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

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
