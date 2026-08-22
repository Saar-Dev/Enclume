import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './240_users_role.js'
import { assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const USERS_ROLE_COLUMNS = ['role', 'role_granted_by', 'role_granted_at']

// Tourne toujours, contrairement aux tests transactionnels ci-dessous (sautés dès que la migration a
// déjà tourné en dev) — détecte une dérive entre ce fichier et le schéma réel (SCHEMADRIFT-EXOTEMPLATES1,
// docs/JOURNAL8.md 2026-08-12).
test('schéma réel — users porte les colonnes/contrainte role de la migration 240', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'users', USERS_ROLE_COLUMNS)
  await assertConstraintExists(db, 'users', 'chk_users_role')
})

test('migration 240 ajoute role/role_granted_by/role_granted_at avec défaut, et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('users', 'role')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    for (const column of USERS_ROLE_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('users', column), true, `colonne manquante: ${column}`)
    }

    const [testUser] = await trx('users').insert({
      email: `240-test-${Date.now()}@example.invalid`,
      password_hash: 'x',
      username: '240-test-user',
    }).returning(['id', 'role'])
    assert.equal(testUser.role, 'user', 'défaut attendu : role=user')

    await down(trx)
    assert.equal(await trx.schema.hasColumn('users', 'role'), false)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Test séparé : une violation de contrainte CHECK avorte la transaction Postgres en cours (toute
// commande suivante échoue avec "current transaction is aborted" jusqu'au ROLLBACK) — donc pas de
// down()/assertion après elle dans la même transaction. On se contente de vérifier le rejet, puis on
// laisse le throw final déclencher le ROLLBACK complet (up() y compris) sans rien exécuter d'autre.
test('la contrainte chk_users_role refuse une valeur hors user/admin', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('users', 'role')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    const [testUser] = await trx('users').insert({
      email: `240-test-chk-${Date.now()}@example.invalid`,
      password_hash: 'x',
      username: '240-test-chk-user',
    }).returning(['id'])

    await assert.rejects(
      trx('users').where({ id: testUser.id }).update({ role: 'superadmin' }),
      /chk_users_role/,
      'la contrainte CHECK doit refuser une valeur hors user/admin'
    )

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
