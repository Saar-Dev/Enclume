import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './259_ref_careers_illustration_english.js'

const SAMPLE = [
  { code: 'artisan_artiste', before: 'assets/s4_artisan.webp', after: 'assets/career_artisan.webp' },
  { code: 'chasseur_primes', before: 'assets/s4_chasseurprime.webp', after: 'assets/career_bounty_hunter.webp' },
  { code: 'officier_militaire_souterrain', before: 'assets/s4_officier_militaire_souterrain.webp', after: 'assets/career_military_officer_underground.webp' },
  { code: 'voleur_criminel', before: 'assets/s4_voleur.webp', after: 'assets/career_thief.webp' },
]

test('schéma réel — ref_careers.illustration porte les chemins anglais après la migration 259', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const rows = await db('ref_careers').whereIn('code', SAMPLE.map(s => s.code)).select('code', 'illustration')
  assert.equal(rows.length, SAMPLE.length)
  for (const row of rows) {
    const expected = SAMPLE.find(s => s.code === row.code)
    assert.equal(row.illustration, expected.after, `${row.code} n'a pas le chemin anglais attendu`)
  }
})

test('migration 259 renomme illustration (37 carrières) et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    // état courant (déjà migré en pratique) : down() doit ramener les anciens chemins français
    await down(trx)
    for (const s of SAMPLE) {
      const row = await trx('ref_careers').where({ code: s.code }).first('illustration')
      assert.equal(row.illustration, s.before, `${s.code} — down() n'a pas restauré l'ancien chemin`)
    }

    await up(trx)
    for (const s of SAMPLE) {
      const row = await trx('ref_careers').where({ code: s.code }).first('illustration')
      assert.equal(row.illustration, s.after, `${s.code} — up() n'a pas appliqué le nouveau chemin`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
