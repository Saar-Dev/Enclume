// Script à usage unique — clôture WOUND-SURVIVAL-MINUTES-HOURS : fausse alerte, pas une
// contradiction RAW. Détail complet : JOURNAL8.md, session du 2026-10-14.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_wound_survival_minutes_hours.js

import db from '../db/knex.js'

const CODE = 'WOUND-SURVIVAL-MINUTES-HOURS'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : clôturé (fausse alerte) ---\n' +
    "Lecture directe du RAW (REGLEBLESSURES.md:247-248 et :470-485) : ce ne sont PAS deux valeurs " +
    'contradictoires pour la même situation, mais deux mécaniques distinctes et déjà clairement ' +
    "séparées par le livre lui-même. p.237 : une blessure mortelle/membre détruit JAMAIS stabilisée " +
    "tue en quelques MINUTES (= niveau de Constitution). p.240, sous-section Infection : une blessure " +
    "déjà stabilisée mais qui s'infecte ensuite par manque de soins continus tue en quelques HEURES " +
    "(= Constitution, ou moitié sur échec du Test). Le code garde déjà les heures pour l'infection, " +
    "correct. Le délai en minutes (mort rapide si jamais stabilisée) n'est pas modélisé, mais c'est " +
    "le périmètre exact d'un autre ticket déjà ouvert, WOUND-STABILIZATION-UNMODELED — pas un oubli " +
    'de celui-ci. Aucun code touché, aucune décision de règle à prendre : le livre tranchait déjà.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'wont_fix',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
