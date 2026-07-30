import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import {
  nextSeverity, previousSeverity, resolveWoundInsertion, resolveWoundImprovement,
  buildWoundInsertionUndoEntries,
} from './woundUtils.js'

// Lancement manuel (aucun script npm test dans le projet) :
//   DATABASE_URL=... node --test server/src/lib/woundUtils.test.mjs
// Les tests DB tournent entièrement dans une transaction rollback (patron
// server/src/db/migrations/154_world_effects_runtime.test.mjs) — rien n'est jamais persisté.
const skip = !process.env.DATABASE_URL

test('previousSeverity est l\'inverse exact de nextSeverity, sur toute l\'échelle', () => {
  assert.equal(previousSeverity('legere'), null)
  assert.equal(previousSeverity('moyenne'), 'legere')
  assert.equal(previousSeverity('grave'), 'moyenne')
  assert.equal(previousSeverity('critique'), 'grave')
  assert.equal(previousSeverity('mortelle'), 'critique')
  assert.equal(nextSeverity('legere'), 'moyenne')
  assert.equal(nextSeverity('mortelle'), null)
})

// Crée la chaîne complète users -> campaigns -> characters -> char_sheet requise par
// character_wounds.char_sheet_id, avec un game_time_resolved_minutes connu.
async function createFixture(trx, { resolvedMinutes = 1000 } = {}) {
  const [user] = await trx('users')
    .insert({ email: `wound-test-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wound-test' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({
      gm_id: user.id, name: 'Campagne test', invite_code: `WND-${Date.now()}-${Math.random()}`,
      game_time_minutes: resolvedMinutes, game_time_resolved_minutes: resolvedMinutes,
    })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, name: 'Perso test' })
    .returning('*')
  const [charSheet] = await trx('char_sheet')
    .insert({ character_id: character.id })
    .returning('*')
  return { user, campaign, charSheet }
}

test('resolveWoundInsertion stampe occurred_at_game_minutes depuis game_time_resolved_minutes', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx, { resolvedMinutes: 4242 })
    const { wound } = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne')
    assert.equal(wound.occurred_at_game_minutes, 4242)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : sans promotion, deletedWounds vide, une seule undoEntry insert', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne')
    assert.deepEqual(result.deletedWounds, [])
    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.deepEqual(undoEntries, [{ table: 'character_wounds', rowId: result.wound.id, previousValues: null }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : promotion en cascade, deletedWounds capture les lignes supprimées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    // corps/moyenne maxCount=3 -> 2 cases existantes déclenchent déjà la cascade (currentCount >= maxCount-1)
    const existing = []
    for (let i = 0; i < 2; i++) {
      const [row] = await trx('character_wounds')
        .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'moyenne', occurred_at_game_minutes: 100 + i })
        .returning('*')
      existing.push(row)
    }

    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne')
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(result.deletedWounds.length, 2)
    assert.deepEqual(new Set(result.deletedWounds.map(w => w.id)), new Set(existing.map(w => w.id)))

    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.equal(undoEntries.length, 3) // 2 delete-undo (insert) + 1 insert-undo (delete)
    for (const w of existing) {
      assert.ok(undoEntries.some(e => e.rowId === w.id && e.previousValues?.id === w.id))
    }
    assert.ok(undoEntries.some(e => e.rowId === result.wound.id && e.previousValues === null))

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id, location: 'corps' }).select('*')
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].severity, 'grave')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Grave -> Moyenne, nouvel horodatage, is_stabilized conservé', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const [original] = await trx('character_wounds')
      .insert({
        char_sheet_id: charSheet.id, location: 'bras_droit', severity: 'grave',
        is_stabilized: true, occurred_at_game_minutes: 100,
      })
      .returning('*')

    // avance le temps résolu pour vérifier que la nouvelle case prend bien la valeur COURANTE,
    // pas celle héritée de la case d'origine (100)
    const campaignRow = await trx('char_sheet')
      .join('characters', 'characters.id', 'char_sheet.character_id')
      .where('char_sheet.id', charSheet.id)
      .select('characters.campaign_id')
      .first()
    await trx('campaigns').where({ id: campaignRow.campaign_id }).update({ game_time_resolved_minutes: 2000 })

    const { wound, healed } = await resolveWoundImprovement(trx, original.id)
    assert.equal(healed, false)
    assert.equal(wound.severity, 'moyenne')
    assert.equal(wound.location, 'bras_droit')
    assert.equal(wound.is_stabilized, true)
    assert.equal(wound.occurred_at_game_minutes, 2000)

    const stillThere = await trx('character_wounds').where({ id: original.id }).first()
    assert.equal(stillThere, undefined)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Légère guérit entièrement (pas de nouvelle case)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const [original] = await trx('character_wounds')
      .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'legere', is_stabilized: false })
      .returning('*')

    const { wound, healed } = await resolveWoundImprovement(trx, original.id)
    assert.equal(healed, true)
    assert.equal(wound, null)

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id }).select('*')
    assert.equal(remaining.length, 0)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement sur une blessure inconnue lève AppError(404)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    await assert.rejects(
      resolveWoundImprovement(trx, '00000000-0000-0000-0000-000000000000'),
      (err) => err instanceof AppError && err.statusCode === 404,
    )
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test.after(async () => { await db.destroy() })
