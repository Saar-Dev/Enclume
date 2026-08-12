import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { listUsers, changeUserRole } from './adminUserService.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/adminUserService.test.mjs
const skip = !process.env.DATABASE_URL

async function createUser(role = 'user') {
  const [user] = await db('users')
    .insert({
      email: `adminuser-test-${Date.now()}-${Math.random()}@test.local`,
      password_hash: 'x',
      username: `adminuser-test-${Math.random().toString(36).slice(2, 8)}`,
      role,
    })
    .returning('*')
  return user
}

async function cleanup(...users) {
  const ids = users.filter(Boolean).map(u => u.id)
  if (ids.length) await db('users').whereIn('id', ids).del()
}

test('listUsers — jamais password_hash, contient role', { skip }, async () => {
  const u = await createUser()
  try {
    const users = await listUsers()
    const found = users.find(x => x.id === u.id)
    assert.ok(found, 'utilisateur créé doit apparaître dans la liste')
    assert.equal(found.password_hash, undefined, 'password_hash ne doit jamais être exposé')
    assert.equal(found.role, 'user')
  } finally {
    await cleanup(u)
  }
})

test('changeUserRole — promotion : role_granted_by/role_granted_at posés', { skip }, async () => {
  const actor = await createUser('admin')
  const target = await createUser('user')
  try {
    const updated = await changeUserRole(actor.id, target.id, 'admin')
    assert.equal(updated.role, 'admin')

    const reloaded = await db('users').where({ id: target.id }).first()
    assert.equal(reloaded.role_granted_by, actor.id)
    assert.notEqual(reloaded.role_granted_at, null)
  } finally {
    await cleanup(actor, target)
  }
})

test('changeUserRole — rejette une valeur de rôle invalide (400)', { skip }, async () => {
  const actor = await createUser('admin')
  const target = await createUser('user')
  try {
    await assert.rejects(
      changeUserRole(actor.id, target.id, 'superadmin'),
      /role doit être/
    )
  } finally {
    await cleanup(actor, target)
  }
})

test('changeUserRole — 404 si la cible n\'existe pas', { skip }, async () => {
  const actor = await createUser('admin')
  try {
    await assert.rejects(
      changeUserRole(actor.id, '00000000-0000-0000-0000-000000000000', 'admin'),
      /introuvable/
    )
  } finally {
    await cleanup(actor)
  }
})

// La garde (adminUserService.js) compte le nombre total d'admins, sans regarder qui fait la
// demande — c'est la formulation correcte de l'invariant ("il doit toujours rester au moins un
// admin"), pas une règle ad hoc sur l'auto-rétrogradation. Note de conception : avec le seul point
// d'entrée actuel (requireAdmin exige déjà que l'acteur soit admin), un acteur ≠ cible implique
// mathématiquement ≥2 admins avant l'opération — la garde ne peut donc se déclencher aujourd'hui
// que sur une auto-rétrogradation. Elle reste écrite en général plutôt qu'en cas particulier pour
// rester correcte si un futur appelant ne garantissait plus cette hypothèse.
test('changeUserRole — bloque la rétrogradation qui ferait tomber le compte d\'admins à zéro', { skip }, async () => {
  const solo = await createUser('admin')
  try {
    const before = await db('users').where({ role: 'admin' }).count('* as c').first()
    if (Number(before.c) !== 1) {
      // D'autres admins existent déjà sur cette base de test — le scénario "dernier admin" ne peut
      // pas être isolé proprement sans toucher aux comptes d'un autre développeur/session. On ne
      // fausse pas le test en supposant un état qu'on n'a pas vérifié : on l'ignore explicitement.
      return
    }
    await assert.rejects(
      changeUserRole(solo.id, solo.id, 'user'),
      /dernier administrateur/
    )
    const reloaded = await db('users').where({ id: solo.id }).first()
    assert.equal(reloaded.role, 'admin', 'le rôle ne doit pas avoir changé après le rejet')
  } finally {
    await cleanup(solo)
  }
})

test('changeUserRole — autorise la rétrogradation quand un autre admin reste', { skip }, async () => {
  const admin1 = await createUser('admin')
  const admin2 = await createUser('admin')
  try {
    const updated = await changeUserRole(admin1.id, admin2.id, 'user')
    assert.equal(updated.role, 'user')
  } finally {
    await cleanup(admin1, admin2)
  }
})

test.after(async () => { await db.destroy() })
