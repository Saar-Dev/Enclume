import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './253_seed_ref_exo_equipment.js'

// Tourne toujours (contrairement au test transactionnel ci-dessous, sauté dès que la migration a
// déjà tourné en dev) — vérifie l'état réel du catalogue contre docs/REGLES/SEEDEXO.md.
test('données réelles — ref_exo_equipment porte les 84 lignes du catalogue avec la bonne répartition', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const total = (await db('ref_exo_equipment').count('id'))[0].count
  assert.equal(Number(total), 84)

  const byFamily = await db('ref_exo_equipment').select('family').count('id').groupBy('family')
  const familyCounts = Object.fromEntries(byFamily.map((r) => [r.family, Number(r.count)]))
  assert.equal(familyCounts.arme, 17)
  assert.equal(familyCounts.systeme, 67)

  // Systèmes défensifs classés family='arme' — décision RAW explicite (§12.1bis point 6)
  const defensifs = await db('ref_exo_equipment').where({ category: 'Systèmes défensifs' })
  assert.equal(defensifs.length, 6)
  assert.ok(defensifs.every((r) => r.family === 'arme'), 'Systèmes défensifs doivent être family=arme')

  // En-tête source corrigé (SEEDEXO.md:789) — ces 7 lignes vivent sous "Systèmes divers", pas "furtifs"
  const divers = await db('ref_exo_equipment').where({ category: 'Systèmes divers' })
  assert.equal(divers.length, 7)
  const diversNames = divers.map((r) => r.name).sort()
  assert.ok(diversNames.some((n) => n.startsWith('Antivol')))
  assert.ok(diversNames.some((n) => n === 'Autopilote'))

  const furtifs = await db('ref_exo_equipment').where({ category: 'Systèmes furtifs' })
  assert.equal(furtifs.length, 6)
  assert.ok(furtifs.every((r) => !r.name.startsWith('Antivol')), 'Antivol ne doit pas être dans Systèmes furtifs')

  // Prix non-flat repris en price_modifier (§12.1bis point 5), pas perdus/aplati en un seul entier
  const pince = await db('ref_exo_equipment').where({ name: 'Pince/Griffe' }).first()
  assert.equal(pince.price, null)
  assert.equal(pince.price_modifier, '100 x (FOR x FOR)')

  const amortisseurs = await db('ref_exo_equipment').where({ name: 'Amortisseurs de saut' }).first()
  assert.equal(amortisseurs.price, 1000)
  assert.equal(amortisseurs.price_modifier, "x cat. de l'exo")
})

test('migration 253 seede le catalogue ref_exo_equipment et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = (await db('ref_exo_equipment').count('id'))[0].count > 0
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const rows = await trx('ref_exo_equipment')
    assert.equal(rows.length, 84)

    await down(trx)
    const afterDown = await trx('ref_exo_equipment')
    assert.equal(afterDown.length, 0)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
