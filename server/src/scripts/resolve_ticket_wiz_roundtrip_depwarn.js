// Script à usage unique — clôture le ticket WIZ-ROUNDTRIP-DEPWARN « DeprecationWarning pg dans
// creationRoundTrip.test.mjs ». Déjà corrigé dans cette même session (commit 78e24510), jamais
// reflété en base — oubli identique à BETA-38, découvert pendant l'audit de synchronisation des
// tickets déclenché par cette découverte (2026-10-13).
// Commit 78e24510 : Promise.all sur une même transaction pg (addAdvantage ET grantAdvantage,
// advantageService.js) converti en await séquentiels, même patron que mutationService.js#addMutation.
// Purement technique (aucun comportement visuel ni règle de jeu) : 5/5 tests DB-backed
// (advantageService.test.mjs + creationRoundTrip.test.mjs), DeprecationWarning confirmé disparu
// (--trace-deprecation) — pas de scénario réel à valider en jeu, résolu sans attendre Saar.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_wiz_roundtrip_depwarn.js

import db from '../db/knex.js'

const CODE = 'WIZ-ROUNDTRIP-DEPWARN'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : clôturé, correctif déjà en place (audit de synchronisation tickets) ---\n' +
    'Commit 78e24510 (même session) : Promise.all sur transaction pg converti en await séquentiels ' +
    'dans addAdvantage ET grantAdvantage. Testé : node --check, DeprecationWarning disparu ' +
    '(--trace-deprecation), 5/5 tests DB-backed, aucune régression. Purement technique, aucune ' +
    'validation en jeu requise.'

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
