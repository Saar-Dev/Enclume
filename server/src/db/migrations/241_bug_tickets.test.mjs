import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './241_bug_tickets.js'
import { assertTableExists, assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

// Lancement manuel : node --env-file=../.env --test server/src/db/migrations/241_bug_tickets.test.mjs
const skip = !process.env.DATABASE_URL

const BUG_TICKETS_COLUMNS = [
  'id', 'reporter_id', 'origin', 'category', 'domain', 'title', 'description', 'context',
  'status', 'priority', 'cluster_label', 'linked_bug_code', 'admin_notes',
  'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
]

function validRow(overrides = {}) {
  return {
    origin: 'player',
    category: 'bug',
    title: 'Titre de test',
    description: 'Description de test',
    ...overrides,
  }
}

// Tourne toujours, contrairement aux tests transactionnels ci-dessous (sautés dès que la migration a
// déjà tourné en dev) — détecte une dérive entre ce fichier et le schéma réel (SCHEMADRIFT-EXOTEMPLATES1,
// docs/JOURNAL8.md 2026-08-12).
test('schéma réel — bug_tickets porte toutes les colonnes/contraintes de la migration 241', { skip }, async () => {
  await assertTableExists(db, 'bug_tickets')
  await assertColumnsExist(db, 'bug_tickets', BUG_TICKETS_COLUMNS)
  for (const constraint of [
    'chk_bug_tickets_origin', 'chk_bug_tickets_category', 'chk_bug_tickets_status', 'chk_bug_tickets_priority',
  ]) await assertConstraintExists(db, 'bug_tickets', constraint)
})

test('migration 241 crée bug_tickets avec les colonnes attendues, insert valide, et revient proprement', {
  skip,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('bug_tickets')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    for (const column of BUG_TICKETS_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('bug_tickets', column), true, `colonne manquante: ${column}`)
    }

    const [row] = await trx('bug_tickets').insert(validRow()).returning('*')
    assert.equal(row.status, 'new', 'défaut attendu : status=new')
    assert.equal(row.priority, null, 'priorité non posée à la création')
    assert.equal(row.reporter_id, null, 'reporter_id nullable (log)')

    await down(trx)
    assert.equal(await trx.schema.hasTable('bug_tickets'), false)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Une violation de contrainte CHECK avorte la transaction Postgres en cours — chaque contrainte est
// donc testée dans sa propre transaction, jamais suivie d'une autre assertion dans la même (leçon
// déjà actée sur la migration 240_users_role.test.mjs).
const checks = [
  { column: 'origin', constraint: 'chk_bug_tickets_origin', bad: 'npc' },
  { column: 'category', constraint: 'chk_bug_tickets_category', bad: 'feature' },
  { column: 'status', constraint: 'chk_bug_tickets_status', bad: 'closed' },
  { column: 'priority', constraint: 'chk_bug_tickets_priority', bad: 'urgent' },
]

for (const { column, constraint, bad } of checks) {
  test(`la contrainte ${constraint} refuse une valeur hors énumération (${column})`, {
    skip,
  }, async () => {
    const alreadyApplied = await db.schema.hasTable('bug_tickets')
    if (alreadyApplied) return

    await assert.rejects(db.transaction(async (trx) => {
      await up(trx)

      await assert.rejects(
        trx('bug_tickets').insert(validRow({ [column]: bad })),
        new RegExp(constraint),
        `la contrainte ${constraint} doit refuser une valeur hors énumération`
      )

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  })
}

test.after(async () => { await db.destroy() })
