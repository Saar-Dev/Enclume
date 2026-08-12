import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { bootstrapAdminFromEnv } from './bootstrapAdmin.js'

const withTestUser = async (fn) => {
  const [user] = await db('users').insert({
    email: `bootstrap-test-${Date.now()}@example.invalid`,
    password_hash: 'x',
    username: 'bootstrap-test-user',
  }).returning(['id', 'email', 'role'])
  try {
    await fn(user)
  } finally {
    await db('users').where({ id: user.id }).delete()
  }
}

const withEnv = async (value, fn) => {
  const original = process.env.ADMIN_BOOTSTRAP_EMAIL
  if (value === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL
  else process.env.ADMIN_BOOTSTRAP_EMAIL = value
  try {
    await fn()
  } finally {
    if (original === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL
    else process.env.ADMIN_BOOTSTRAP_EMAIL = original
  }
}

test('bootstrapAdminFromEnv — variable absente : no-op, aucun compte modifié', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await withTestUser(async (user) => {
    await withEnv(undefined, async () => {
      await bootstrapAdminFromEnv()
      const reloaded = await db('users').where({ id: user.id }).first()
      assert.equal(reloaded.role, 'user')
    })
  })
})

test('bootstrapAdminFromEnv — email correspondant : promotion, granted_by reste NULL', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await withTestUser(async (user) => {
    await withEnv(user.email, async () => {
      await bootstrapAdminFromEnv()
      const reloaded = await db('users').where({ id: user.id }).first()
      assert.equal(reloaded.role, 'admin')
      assert.equal(reloaded.role_granted_by, null)
      assert.notEqual(reloaded.role_granted_at, null)
    })
  })
})

test('bootstrapAdminFromEnv — idempotent : un second appel ne modifie plus role_granted_at', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await withTestUser(async (user) => {
    await withEnv(user.email, async () => {
      await bootstrapAdminFromEnv()
      const first = await db('users').where({ id: user.id }).first()

      await bootstrapAdminFromEnv()
      const second = await db('users').where({ id: user.id }).first()

      assert.equal(second.role, 'admin')
      assert.equal(second.role_granted_at.getTime(), first.role_granted_at.getTime())
    })
  })
})

test('bootstrapAdminFromEnv — email sans compte correspondant : ne jette pas, ne modifie rien', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await withEnv('bootstrap-nomatch@example.invalid', async () => {
    await assert.doesNotReject(bootstrapAdminFromEnv())
  })
})

test.after(async () => { await db.destroy() })
