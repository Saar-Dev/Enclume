// Script à usage unique — clôture TIRMODE1, ticket périmé : Saar soupçonnait déjà que le
// changement de mode de tir était implanté (2026-08-22), vérifié dans le code avant clôture (pas
// juste sur son intuition) — CombatGmDeclareWindow.jsx calcule déjà `availableFireModes` par arme
// (ref_fire_mode découpé en modes possibles), expose un sélecteur `fire_mode` au même titre que
// `weapon` (ligne ~686), et réinitialise automatiquement le mode si l'arme rechargée ne le supporte
// plus (ligne ~308-314). Aucune trace d'un mécanisme "à construire". Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_tirmode1.js

import db from '../db/knex.js'

const CODE = 'TIRMODE1'

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
    'Périmé, vérifié 2026-08-22 (Saar soupçonnait déjà l\'implémentation) : le changement de mode de ' +
    'tir (CC/RC/RL) est déjà entièrement câblé — CombatGmDeclareWindow.jsx calcule availableFireModes ' +
    'par arme (ref_fire_mode), expose un sélecteur fire_mode, réinitialise automatiquement le mode si ' +
    'l\'arme rechargée ne le supporte plus. Aucun correctif nécessaire.'

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
