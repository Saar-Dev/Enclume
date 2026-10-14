import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { fetchEquipmentShockDsl } from './damageService.js'

// Lancement manuel : node --env-file=.env --test server/src/lib/damageService.test.mjs
// Lecture seule — aucune écriture, aucun fixture à nettoyer.
const skip = !process.env.DATABASE_URL

test('fetchEquipmentShockDsl — ligne catalogue avec Choc câblé (Lance-flammes, migration 323) → DSL correct', { skip }, async () => {
  const row = await db('ref_equipment').where({ name: 'Lance-flammes' }).select('id').first()
  assert.ok(row, 'précondition : le Lance-flammes doit exister en base')
  const dsl = await fetchEquipmentShockDsl(db, row.id)
  assert.deepEqual(dsl, { action: 'SET', value: '2D6', gateLocation: null, reducedByArmor: true })
})

test('fetchEquipmentShockDsl — equipmentId null → null, jamais un throw', async () => {
  assert.equal(await fetchEquipmentShockDsl(db, null), null)
})

test('fetchEquipmentShockDsl — equipmentId inconnu (ligne catalogue introuvable) → null', { skip }, async () => {
  assert.equal(await fetchEquipmentShockDsl(db, '00000000-0000-0000-0000-000000000000'), null)
})

test.after(async () => { await db.destroy() })
