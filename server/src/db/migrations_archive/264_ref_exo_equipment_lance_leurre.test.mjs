import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './264_ref_exo_equipment_lance_leurre.js'

const NAMES = Array.from({ length: 10 }, (_, i) => `Lance-leurre Taille ${i + 1}`)

test('données réelles — les 10 lignes Lance-leurre existent avec la bonne grille', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const rows = await db('ref_exo_equipment').whereIn('name', NAMES)
  assert.equal(rows.length, 10, `10 lignes attendues, ${rows.length} trouvées`)

  for (const row of rows) {
    assert.equal(row.family, 'arme')
    assert.equal(row.category, 'Torpilles et missiles')
    assert.equal(row.init_mod, -7)
    assert.equal(row.fire_mode, 'CC')
    assert.equal(row.tech_level, 'II')
    assert.equal(row.damage, null, `${row.name} ne devrait avoir aucun dégât (leurre)`)
  }

  const t1 = rows.find((r) => r.name === 'Lance-leurre Taille 1')
  assert.equal(t1.price, 1000)
  assert.equal(t1.range, 'Courte')
  assert.equal(t1.rarity, '15 (20)')

  const t3 = rows.find((r) => r.name === 'Lance-leurre Taille 3')
  assert.equal(t3.price, 4000)
  assert.equal(t3.range, 'Moyenne')
  assert.match(t3.description, /Attesté \(Moloch/)

  const t10 = rows.find((r) => r.name === 'Lance-leurre Taille 10')
  assert.equal(t10.price, 250000)
  assert.equal(t10.range, 'Extrême')
  assert.equal(t10.rarity, '-1 (5)')
})

test('migration 264 ajoute les 10 lignes et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db('ref_exo_equipment').where({ name: 'Lance-leurre Taille 1' }).first()
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const rows = await trx('ref_exo_equipment').whereIn('name', NAMES)
    assert.equal(rows.length, 10)

    await down(trx)
    const afterDown = await trx('ref_exo_equipment').whereIn('name', NAMES)
    assert.equal(afterDown.length, 0)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
