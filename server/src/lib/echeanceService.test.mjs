import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { ECHEANCE_TYPE_REGISTRY } from '../../../shared/echeanceTypeRegistry.js'
import {
  createEcheance, sweepDueEcheances, previewDueEcheances, resolveEcheanceNow,
} from './echeanceService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/echeanceService.test.mjs
// Patron rollback (154_world_effects_runtime.test.mjs) : rien n'est jamais persisté.
const skip = !process.env.DATABASE_URL

async function createFixture(trx) {
  const [user] = await trx('users')
    .insert({ email: `echeance-test-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'echeance-test' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({
      gm_id: user.id, name: 'Campagne test échéances', invite_code: `ECH-${Date.now()}-${Math.random()}`,
      game_time_minutes: 1000, game_time_resolved_minutes: 1000,
    })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, name: 'Perso test' })
    .returning('*')
  return { campaign, character }
}

// Variante non-transactionnelle de createFixture — committe réellement (nécessaire pour tester
// previewDueEcheances, qui lit via db et non trx). Toujours nettoyée explicitement par l'appelant.
async function createRealFixture() {
  const [user] = await db('users')
    .insert({ email: `echeance-real-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'echeance-real' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({
      gm_id: user.id, name: 'Campagne test échéances (réelle)', invite_code: `ECHR-${Date.now()}-${Math.random()}`,
      game_time_minutes: 1000, game_time_resolved_minutes: 1000,
    })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, name: 'Perso test réel' })
    .returning('*')
  campaign.characterId = character.id
  return { user, campaign }
}

function withRegistryEntry(entry, fn) {
  ECHEANCE_TYPE_REGISTRY.push(entry)
  return fn().finally(() => { ECHEANCE_TYPE_REGISTRY.length = 0 })
}

test('createEcheance refuse un condition_type absent du registre', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character } = await createFixture(trx)
    await assert.rejects(
      createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'inconnu', nextDueMinutes: 2000,
      }),
      (err) => err instanceof AppError && err.statusCode === 500,
    )
    throw new Error('ROLLBACK_ECHEANCE_TEST')
  }), /ROLLBACK_ECHEANCE_TEST/)
})

test('createEcheance dénormalise interactive depuis le registre, jamais fourni par l\'appelant', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_auto', interactive: false, handler: async () => ({ resolved: true }) },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      const echeance = await createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'test_auto', nextDueMinutes: 2000,
      })
      assert.equal(echeance.interactive, false)
      assert.equal(echeance.status, 'active')
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('sweepDueEcheances : reschedule fait avancer next_due_minutes et décrémente occurrences_remaining', { skip }, async () => {
  await withRegistryEntry(
    {
      key: 'test_recurring',
      interactive: false,
      handler: async () => ({ resolved: true, reschedule: { intervalMinutes: 100, occurrencesRemaining: 1 }, spawn: [], undoEntries: [] }),
    },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      const echeance = await createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'test_recurring',
        nextDueMinutes: 900, intervalMinutes: 100, occurrencesRemaining: 2,
      })
      await sweepDueEcheances(trx, campaign.id, 1000)
      const after = await trx('game_echeances').where({ id: echeance.id }).first()
      assert.equal(after.status, 'active')
      assert.equal(after.next_due_minutes, 1000) // 900 + 100
      assert.equal(after.occurrences_remaining, 1)
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('sweepDueEcheances : reschedule null -> completed', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_oneshot', interactive: false, handler: async () => ({ resolved: true, reschedule: null, spawn: [], undoEntries: [] }) },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      const echeance = await createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'test_oneshot', nextDueMinutes: 900,
      })
      await sweepDueEcheances(trx, campaign.id, 1000)
      const after = await trx('game_echeances').where({ id: echeance.id }).first()
      assert.equal(after.status, 'completed')
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('sweepDueEcheances : garde-fou anti-boucle infinie (intervalMinutes <= 0 -> error, jamais de boucle)', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_bad_interval', interactive: false, handler: async () => ({ resolved: true, reschedule: { intervalMinutes: 0, occurrencesRemaining: 5 }, spawn: [], undoEntries: [] }) },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      const echeance = await createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'test_bad_interval', nextDueMinutes: 900,
      })
      await sweepDueEcheances(trx, campaign.id, 1000)
      const after = await trx('game_echeances').where({ id: echeance.id }).first()
      assert.equal(after.status, 'error')
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('sweepDueEcheances : un handler qui plante passe error et n\'empêche pas la résolution des autres', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_crash', interactive: false, handler: async () => { throw new Error('boom') } },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      ECHEANCE_TYPE_REGISTRY.push({ key: 'test_ok', interactive: false, handler: async () => ({ resolved: true, reschedule: null, spawn: [], undoEntries: [] }) })
      const crashing = await createEcheance(trx, { campaignId: campaign.id, characterId: character.id, conditionType: 'test_crash', nextDueMinutes: 900 })
      const ok = await createEcheance(trx, { campaignId: campaign.id, characterId: character.id, conditionType: 'test_ok', nextDueMinutes: 900 })
      await sweepDueEcheances(trx, campaign.id, 1000)
      assert.equal((await trx('game_echeances').where({ id: crashing.id }).first()).status, 'error')
      assert.equal((await trx('game_echeances').where({ id: ok.id }).first()).status, 'completed')
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('sweepDueEcheances : spawn crée une nouvelle échéance dans le même trx, interactive résolu depuis le registre', { skip }, async () => {
  await withRegistryEntry(
    {
      key: 'test_spawner',
      interactive: false,
      handler: async () => ({
        resolved: true, reschedule: null,
        spawn: [{ conditionType: 'test_spawned', payload: { foo: 'bar' }, nextDueMinutes: 5000 }],
        undoEntries: [],
      }),
    },
    () => {
      ECHEANCE_TYPE_REGISTRY.push({ key: 'test_spawned', interactive: true, handler: async () => ({ resolved: false }) })
      return assert.rejects(db.transaction(async (trx) => {
        const { campaign, character } = await createFixture(trx)
        await createEcheance(trx, { campaignId: campaign.id, characterId: character.id, conditionType: 'test_spawner', nextDueMinutes: 900 })
        await sweepDueEcheances(trx, campaign.id, 1000)
        const spawned = await trx('game_echeances').where({ campaign_id: campaign.id, condition_type: 'test_spawned' }).first()
        assert.ok(spawned)
        assert.equal(spawned.interactive, true)
        assert.deepEqual(spawned.payload, { foo: 'bar' })
        assert.equal(spawned.next_due_minutes, 5000)
        throw new Error('ROLLBACK_ECHEANCE_TEST')
      }), /ROLLBACK_ECHEANCE_TEST/)
    },
  )
})

test('previewDueEcheances : ne retourne que les échéances interactives dues, jamais les automatiques', { skip }, async () => {
  // previewDueEcheances utilise db directement (jamais trx, lecture seule hors transaction) — le
  // patron rollback-dans-trx des autres tests ne peut donc pas la voir (writes non commités,
  // invisibles depuis une autre connexion). On committe réellement puis on nettoie explicitement
  // (cascade FK campaign_id -> characters/game_echeances, donc supprimer la campagne suffit).
  let campaign, user
  try {
    ({ campaign, user } = await createRealFixture())
    await withRegistryEntry(
      { key: 'test_auto2', interactive: false, handler: async () => ({ resolved: true }) },
      async () => {
        ECHEANCE_TYPE_REGISTRY.push({ key: 'test_interactive2', interactive: true, handler: async () => ({ resolved: false }) })
        await createEcheance(db, { campaignId: campaign.id, characterId: campaign.characterId, conditionType: 'test_auto2', nextDueMinutes: 900 })
        const interactiveDue = await createEcheance(db, { campaignId: campaign.id, characterId: campaign.characterId, conditionType: 'test_interactive2', nextDueMinutes: 900 })
        await createEcheance(db, { campaignId: campaign.id, characterId: campaign.characterId, conditionType: 'test_interactive2', nextDueMinutes: 5000 }) // pas encore due

        const preview = await previewDueEcheances(campaign.id, 1000)
        assert.equal(preview.length, 1)
        assert.equal(preview[0].id, interactiveDue.id)
      },
    )
  } finally {
    if (campaign) await db('campaigns').where({ id: campaign.id }).del()
    if (user) await db('users').where({ id: user.id }).del()
  }
})

test('resolveEcheanceNow : résout, applique reschedule, append atomique de undoEntries (y compris depuis NULL)', { skip }, async () => {
  await withRegistryEntry(
    {
      key: 'test_interactive_resolve',
      interactive: true,
      handler: async () => ({
        resolved: true, reschedule: null, spawn: [],
        undoEntries: [{ table: 'character_wounds', rowId: 'fake-id', previousValues: null }],
      }),
    },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      const echeance = await createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'test_interactive_resolve', nextDueMinutes: 900,
      })
      await trx('game_echeances').where({ id: echeance.id }).update({ status: 'pending_mj_review' })

      const campaignBefore = await trx('campaigns').where({ id: campaign.id }).first()
      assert.equal(campaignBefore.pending_advance_undo_log, null)

      const result = await resolveEcheanceNow(trx, echeance.id)
      assert.equal(result.resolved, true)

      const after = await trx('game_echeances').where({ id: echeance.id }).first()
      assert.equal(after.status, 'completed')

      // 2 entrées : celle du handler (character_wounds, testée en dur) + celle que l'engine ajoute
      // lui-même pour sa propre mutation de la ligne game_echeances (correction 2026-07-30, sans ça
      // cancelPendingAdvance ne pouvait pas restaurer next_due_minutes/occurrences_remaining/status
      // d'origine, seulement un statut générique).
      const campaignAfter = await trx('campaigns').where({ id: campaign.id }).first()
      assert.equal(campaignAfter.pending_advance_undo_log.length, 2)
      assert.deepEqual(
        campaignAfter.pending_advance_undo_log.find((e) => e.table === 'character_wounds'),
        { table: 'character_wounds', rowId: 'fake-id', previousValues: null },
      )
      const echeanceUndoEntry = campaignAfter.pending_advance_undo_log.find((e) => e.table === 'game_echeances')
      assert.equal(echeanceUndoEntry.rowId, echeance.id)
      assert.equal(echeanceUndoEntry.previousValues.status, 'pending_mj_review')
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('resolveEcheanceNow : refuse une échéance qui n\'est pas en attente de résolution', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_not_pending', interactive: true, handler: async () => ({ resolved: true, reschedule: null, spawn: [], undoEntries: [] }) },
    () => assert.rejects(db.transaction(async (trx) => {
      const { campaign, character } = await createFixture(trx)
      const echeance = await createEcheance(trx, {
        campaignId: campaign.id, characterId: character.id, conditionType: 'test_not_pending', nextDueMinutes: 900,
      })
      // status reste 'active' — jamais mis en pending_mj_review/awaiting_player_roll
      await assert.rejects(
        resolveEcheanceNow(trx, echeance.id),
        (err) => err instanceof AppError && err.statusCode === 409,
      )
      throw new Error('ROLLBACK_ECHEANCE_TEST')
    }), /ROLLBACK_ECHEANCE_TEST/),
  )
})

test('resolveEcheanceNow : échéance inconnue -> AppError(404)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    await assert.rejects(
      resolveEcheanceNow(trx, '00000000-0000-0000-0000-000000000000'),
      (err) => err instanceof AppError && err.statusCode === 404,
    )
    throw new Error('ROLLBACK_ECHEANCE_TEST')
  }), /ROLLBACK_ECHEANCE_TEST/)
})

test.after(async () => { await db.destroy() })
