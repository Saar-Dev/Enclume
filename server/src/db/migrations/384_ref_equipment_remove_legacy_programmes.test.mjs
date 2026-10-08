import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './384_ref_equipment_remove_legacy_programmes.js'

// Lancement manuel : node --env-file=.env --test server/src/db/migrations/384_ref_equipment_remove_legacy_programmes.test.mjs
// Les trois tests tournent dans une transaction systématiquement annulée (sentinelle ROLLBACK_MIGRATION_TEST,
// même patron que 241_bug_tickets.test.mjs) : aucune écriture ne survit au test, y compris la suppression
// réelle exercée par le test de round-trip.
const skip = !process.env.DATABASE_URL

const FAMILY = 'Équipement informatique et logiciels'
const CATEGORY = 'Programmes'
const EXPECTED_COUNT = 19

test('garde de comptage — up() refuse de continuer si le nombre de lignes ciblées ne vaut pas 19', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const rows = await trx('ref_equipment').select('id').where({ family: FAMILY, category: CATEGORY })
    assert.equal(rows.length, EXPECTED_COUNT, 'précondition : 19 lignes legacy attendues avant le test')

    // Ramène le compte réel à 18 pour ce test seulement — annulé avec le reste de la transaction.
    await trx('ref_equipment').where({ id: rows[0].id }).del()

    await assert.rejects(
      up(trx),
      /18 ligne\(s\) trouvée\(s\).*19 attendues/,
      'la migration doit lever une erreur et ne rien supprimer si le compte réel diverge de 19'
    )

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('garde de référence — up() refuse de continuer si une ligne existante référence encore une des 19 lignes ciblées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const [target] = await trx('ref_equipment').select('id').where({ family: FAMILY, category: CATEGORY }).limit(1)
    const [existingAssoc] = await trx('ref_equipment_skills').select('skill_id').limit(1)

    // Ajoute, pour ce test seulement, une association pointant vers une des 19 lignes ciblées.
    await trx('ref_equipment_skills').insert({ item_id: target.id, skill_id: existingAssoc.skill_id })

    await assert.rejects(
      up(trx),
      /ref_equipment_skills\.item_id.*référencent encore/,
      'la migration doit lever une erreur et ne rien supprimer si une FK pointe encore vers une des 19 lignes'
    )

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('round-trip — up() supprime exactement les 19 lignes ciblées ; down() reste un no-op documenté', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const before = await trx('ref_equipment').select('id').where({ family: FAMILY, category: CATEGORY })
    assert.equal(before.length, EXPECTED_COUNT, 'précondition : 19 lignes legacy attendues avant la migration')

    await up(trx)

    const after = await trx('ref_equipment').where({ family: FAMILY, category: CATEGORY }).count('* as c').first()
    assert.equal(Number(after.c), 0, 'les 19 lignes legacy doivent avoir disparu après up()')

    await down(trx)

    const stillGone = await trx('ref_equipment').where({ family: FAMILY, category: CATEGORY }).count('* as c').first()
    assert.equal(Number(stillGone.c), 0, 'down() est un no-op documenté : il ne restaure pas les lignes supprimées')

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
