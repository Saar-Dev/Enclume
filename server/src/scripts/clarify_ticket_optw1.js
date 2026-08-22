// Script à usage unique — corrige le diagnostic d'OPT-W1 (pas de correctif codé). Le ticket listait
// 3 options non câblées (revers, skill_natural_prog, celebrity) — vérifié une par une avant d'agir :
// `revers` EST déjà câblé (creationService.js:907, gate le tirage de Revers ; settings.revers ->
// reversEnabled côté client, routes/creation.js:200). Seuls skill_natural_prog et celebrity sont
// réellement sans aucun point de lecture server-side (grep confirmé, aucune occurrence hors
// définition/toggle UI). Reste 'new' (2 gaps réels sur 3 initialement listés). Lancement manuel :
// node --env-file=.env server/src/scripts/clarify_ticket_optw1.js

import db from '../db/knex.js'

const CODE = 'OPT-W1'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Diagnostic corrigé 2026-08-22 (pas de correctif codé) : "revers" est en fait déjà câblé — ' +
    'creationService.js:907 (settings.revers gate le tirage de Revers) et routes/creation.js:200 ' +
    '(settings.revers -> reversEnabled transmis au client). Seuls skill_natural_prog et celebrity ' +
    'restent réellement sans aucun point de lecture server-side (grep confirmé sur tout server/src, ' +
    'aucune occurrence hors définition campaignSettingsService.js et toggle UI ' +
    'SectionCharacterSheet.jsx) — 2 gaps réels sur les 3 initialement listés, pas 3.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> statut inchangé (${updated.status}), diagnostic corrigé.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
