// Script à usage unique — clôture COFFRE-REGISTRY-DRIFT1 après correctif (vaultService.js,
// docs/EN_COURS.md, 2026-08-16). Lancement manuel :
// node --env-file=.env server/src/scripts/resolve_ticket_vault_registry_drift.js

import db from '../db/knex.js'

const CODE = 'VAULT-REGISTRY-DRIFT1'

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
    'Corrigé 2026-08-16 : char_gauges enregistrée (CHAR_SHEET_KEYED_TABLES), wizard_locks/' +
    'game_echeances/chat_messages exclues (EXCLUDED_TABLES), exo_sheet nouvelle entrée ' +
    'COMPANION_REGISTRY (clonage dédié cloneExoSheet — cloneRows générique aurait violé ' +
    'exo_sheet_pilot_unique en copiant le pilote de la source), char_inventory_slots clonée via ' +
    'cloneInventoryWithSlots (double FK char_inventory_id+character_id remappée). Test de ' +
    'non-régression ajouté : server/src/services/vaultCloneRegistry.test.mjs (3 tests, verts ' +
    'contre PostgreSQL réel). Suite complète du projet : 309/309 verte.'

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
