import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { ECHEANCE_TYPE_REGISTRY } from '../../../shared/echeanceTypeRegistry.js'
import {
  adjustGameTime, requestGameTimeAdvance, confirmPendingAdvance, cancelPendingAdvance,
} from './gameTimeService.js'
import { createEcheance, resolveEcheanceNow } from './echeanceService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/gameTimeService.test.mjs
//
// adjustGameTime/requestGameTimeAdvance/confirmPendingAdvance/cancelPendingAdvance ouvrent chacune
// leur propre db.transaction() (points d'entrée autonomes, comme depuis une route) — le patron
// rollback-dans-un-trx-englobant des autres fichiers de test ne peut donc pas s'appliquer ici (un
// trx externe et le db.transaction() interne à la fonction ne partagent pas la même connexion, les
// écritures de l'un restent invisibles à l'autre). On committe réellement puis on nettoie
// explicitement (cascade FK campaign_id -> characters/game_echeances : supprimer la campagne suffit).
const skip = !process.env.DATABASE_URL

async function createRealFixture({ displayed = 1000, resolved = 1000 } = {}) {
  const [user] = await db('users')
    .insert({ email: `gts-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'gts-test' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({
      gm_id: user.id, name: 'Campagne test horloge', invite_code: `GTS-${Date.now()}-${Math.random()}`,
      game_time_minutes: displayed, game_time_resolved_minutes: resolved,
    })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, name: 'Perso test horloge' })
    .returning('*')
  return { user, campaign, character }
}

async function cleanup({ user, campaign }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (user) await db('users').where({ id: user.id }).del()
}

function withRegistryEntry(entry, fn) {
  ECHEANCE_TYPE_REGISTRY.push(entry)
  return fn().finally(() => { ECHEANCE_TYPE_REGISTRY.length = 0 })
}

async function getCampaign(id) {
  return db('campaigns').where({ id }).first()
}

// ─── adjustGameTime — régression Lot 1 (4 cas de l'analyse à charge originale + delta=0) ───────

test('adjustGameTime : les 4 cas resolved/displayed + delta=0 rejeté', { skip }, async () => {
  const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
  try {
    // Cas 1 — avance simple au-delà du repère résolu -> resolved avance d'autant.
    let r = await adjustGameTime(fixture.campaign.id, 1000)
    assert.equal(r.displayedAfter, 2000)
    assert.equal(r.resolvedAfter, 2000)

    // Cas 2 — recul pur -> resolved inchangé.
    r = await adjustGameTime(fixture.campaign.id, -500)
    assert.equal(r.displayedAfter, 1500)
    assert.equal(r.resolvedAfter, 2000)

    // Cas 3 — avance qui reste sous le repère déjà résolu -> resolved inchangé, aucune double résolution.
    r = await adjustGameTime(fixture.campaign.id, 300)
    assert.equal(r.displayedAfter, 1800)
    assert.equal(r.resolvedAfter, 2000)

    // Cas 4 — avance qui dépasse le repère déjà résolu -> intervalle réellement neuf seulement.
    r = await adjustGameTime(fixture.campaign.id, 500)
    assert.equal(r.displayedAfter, 2300)
    assert.equal(r.resolvedAfter, 2300)

    await assert.rejects(
      adjustGameTime(fixture.campaign.id, 0),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('adjustGameTime : refuse un delta qui ferait déborder game_time_minutes au-delà de l\'integer Postgres', { skip }, async () => {
  const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
  try {
    await assert.rejects(
      adjustGameTime(fixture.campaign.id, 2147483647),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
    const campaign = await getCampaign(fixture.campaign.id)
    assert.equal(campaign.game_time_minutes, 1000) // inchangé, transaction annulée
  } finally {
    await cleanup(fixture)
  }
})

test('adjustGameTime : refuse un delta très négatif qui dépasserait le minimum integer Postgres', { skip }, async () => {
  const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
  try {
    await assert.rejects(
      adjustGameTime(fixture.campaign.id, -3000000000),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('adjustGameTime : refuse tant qu\'une avance est déjà en attente', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('campaigns').where({ id: fixture.campaign.id }).update({ pending_advance_delta_minutes: 100 })
    await assert.rejects(
      adjustGameTime(fixture.campaign.id, 50),
      (err) => err instanceof AppError && err.statusCode === 409,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('adjustGameTime : le balayage automatique tourne dans la même transaction (pas après coup)', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_gts_auto', interactive: false, handler: async () => ({ resolved: true, reschedule: null, spawn: [], undoEntries: [] }) },
    async () => {
      const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
      try {
        const echeance = await createEcheance(db, {
          campaignId: fixture.campaign.id, characterId: fixture.character.id,
          conditionType: 'test_gts_auto', nextDueMinutes: 1200,
        })
        await adjustGameTime(fixture.campaign.id, 500) // resolved -> 1500, dépasse 1200
        const after = await db('game_echeances').where({ id: echeance.id }).first()
        assert.equal(after.status, 'completed')
      } finally {
        await cleanup(fixture)
      }
    },
  )
})

// ─── requestGameTimeAdvance ──────────────────────────────────────────────────────────────────────

test('requestGameTimeAdvance : chemin rapide identique à adjustGameTime quand rien n\'est dû', { skip }, async () => {
  const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
  try {
    const r = await requestGameTimeAdvance(fixture.campaign.id, 500)
    assert.equal(r.pending, false)
    assert.equal(r.displayedAfter, 1500)
    assert.equal(r.resolvedAfter, 1500)
    const campaign = await getCampaign(fixture.campaign.id)
    assert.equal(campaign.pending_advance_delta_minutes, null)
  } finally {
    await cleanup(fixture)
  }
})

test('requestGameTimeAdvance : refuse un delta hors bornes avant de le poser en pending', { skip }, async () => {
  const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
  try {
    await assert.rejects(
      requestGameTimeAdvance(fixture.campaign.id, 2147483647),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
    const campaign = await getCampaign(fixture.campaign.id)
    assert.equal(campaign.pending_advance_delta_minutes, null)
  } finally {
    await cleanup(fixture)
  }
})

test('requestGameTimeAdvance : échéance interactive due -> pose l\'attente, n\'avance rien', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_gts_interactive', interactive: true, handler: async () => ({ resolved: false }) },
    async () => {
      const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
      try {
        const echeance = await createEcheance(db, {
          campaignId: fixture.campaign.id, characterId: fixture.character.id,
          conditionType: 'test_gts_interactive', nextDueMinutes: 1200,
        })
        const r = await requestGameTimeAdvance(fixture.campaign.id, 500)
        assert.equal(r.pending, true)
        assert.equal(r.echeances.length, 1)
        assert.equal(r.echeances[0].id, echeance.id)

        const campaign = await getCampaign(fixture.campaign.id)
        assert.equal(campaign.game_time_minutes, 1000) // inchangé
        assert.equal(campaign.pending_advance_delta_minutes, 500)

        const echeanceAfter = await db('game_echeances').where({ id: echeance.id }).first()
        assert.equal(echeanceAfter.status, 'pending_mj_review')
      } finally {
        await cleanup(fixture)
      }
    },
  )
})

// ─── confirmPendingAdvance ───────────────────────────────────────────────────────────────────────

test('confirmPendingAdvance : refuse sans avance en attente', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await assert.rejects(
      confirmPendingAdvance(fixture.campaign.id),
      (err) => err instanceof AppError && err.statusCode === 409,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('confirmPendingAdvance : refuse tant qu\'une échéance du lot n\'est pas résolue, puis re-détecte une échéance nouvellement due', { skip }, async () => {
  await withRegistryEntry(
    { key: 'test_confirm_a', interactive: true, handler: async () => ({ resolved: true, reschedule: null, spawn: [], undoEntries: [] }) },
    () => withRegistryEntry(
      { key: 'test_confirm_b', interactive: true, handler: async () => ({ resolved: true, reschedule: null, spawn: [], undoEntries: [] }) },
      async () => {
        const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
        try {
          const echeanceA = await createEcheance(db, {
            campaignId: fixture.campaign.id, characterId: fixture.character.id,
            conditionType: 'test_confirm_a', nextDueMinutes: 1200,
          })
          await requestGameTimeAdvance(fixture.campaign.id, 500) // resolvedAfter visé = 1500, A due -> pending_mj_review

          // refuse : A pas encore résolue
          await assert.rejects(
            confirmPendingAdvance(fixture.campaign.id),
            (err) => err instanceof AppError && err.statusCode === 409,
          )

          await db.transaction((trx) => resolveEcheanceNow(trx, echeanceA.id))

          // une nouvelle échéance interactive apparaît "pendant" la revue (ex. combat entre-temps)
          const echeanceB = await createEcheance(db, {
            campaignId: fixture.campaign.id, characterId: fixture.character.id,
            conditionType: 'test_confirm_b', nextDueMinutes: 1300,
          })

          await assert.rejects(
            confirmPendingAdvance(fixture.campaign.id),
            (err) => err instanceof AppError && err.statusCode === 409,
          )
          const bAfterRefusal = await db('game_echeances').where({ id: echeanceB.id }).first()
          assert.equal(bAfterRefusal.status, 'pending_mj_review') // rejointe automatiquement au lot

          await db.transaction((trx) => resolveEcheanceNow(trx, echeanceB.id))

          const result = await confirmPendingAdvance(fixture.campaign.id)
          assert.equal(result.displayedAfter, 1500)
          assert.equal(result.resolvedAfter, 1500)

          const campaignAfter = await getCampaign(fixture.campaign.id)
          assert.equal(campaignAfter.pending_advance_delta_minutes, null)
          assert.equal(campaignAfter.pending_advance_undo_log, null)
        } finally {
          await cleanup(fixture)
        }
      },
    ),
  )
})

// ─── cancelPendingAdvance — 3 cas de rejeu génériques (update/delete/insert) ────────────────────

test('cancelPendingAdvance : refuse sans avance en attente', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await assert.rejects(
      cancelPendingAdvance(fixture.campaign.id),
      (err) => err instanceof AppError && err.statusCode === 409,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('cancelPendingAdvance : rejoue un UPDATE (previousValues non nul, ligne existe encore)', { skip }, async () => {
  await withRegistryEntry(
    {
      key: 'test_cancel_update',
      interactive: true,
      handler: async (trx, echeance) => {
        const before = await trx('characters').where({ id: echeance.character_id }).first()
        await trx('characters').where({ id: echeance.character_id }).update({ name: 'Nom modifié par le handler' })
        return { resolved: true, reschedule: null, spawn: [], undoEntries: [{ table: 'characters', rowId: before.id, previousValues: before }] }
      },
    },
    async () => {
      const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
      try {
        const echeance = await createEcheance(db, {
          campaignId: fixture.campaign.id, characterId: fixture.character.id,
          conditionType: 'test_cancel_update', nextDueMinutes: 1200,
        })
        await requestGameTimeAdvance(fixture.campaign.id, 500)
        await db.transaction((trx) => resolveEcheanceNow(trx, echeance.id))

        assert.equal((await db('characters').where({ id: fixture.character.id }).first()).name, 'Nom modifié par le handler')
        // 2 entrées : celle du handler (characters) + celle que l'engine ajoute pour sa propre
        // mutation de la ligne game_echeances (correction 2026-07-30).
        assert.equal((await getCampaign(fixture.campaign.id)).pending_advance_undo_log?.length, 2)

        await cancelPendingAdvance(fixture.campaign.id)

        assert.equal((await db('characters').where({ id: fixture.character.id }).first()).name, 'Perso test horloge')
        assert.equal((await db('game_echeances').where({ id: echeance.id }).first()).status, 'active')
        const campaignAfter = await getCampaign(fixture.campaign.id)
        assert.equal(campaignAfter.pending_advance_delta_minutes, null)
        assert.equal(campaignAfter.pending_advance_undo_log, null)
      } finally {
        await cleanup(fixture)
      }
    },
  )
})

test('cancelPendingAdvance : rejoue un DELETE (annule une insertion faite par le handler)', { skip }, async () => {
  await withRegistryEntry(
    {
      key: 'test_cancel_insert',
      interactive: true,
      handler: async (trx, echeance) => {
        const [inserted] = await trx('characters')
          .insert({ campaign_id: echeance.campaign_id, name: 'Créé par le handler' })
          .returning('*')
        return { resolved: true, reschedule: null, spawn: [], undoEntries: [{ table: 'characters', rowId: inserted.id, previousValues: null }] }
      },
    },
    async () => {
      const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
      try {
        const echeance = await createEcheance(db, {
          campaignId: fixture.campaign.id, characterId: fixture.character.id,
          conditionType: 'test_cancel_insert', nextDueMinutes: 1200,
        })
        await requestGameTimeAdvance(fixture.campaign.id, 500)
        await db.transaction((trx) => resolveEcheanceNow(trx, echeance.id))

        const createdRows = await db('characters').where({ campaign_id: fixture.campaign.id, name: 'Créé par le handler' })
        assert.equal(createdRows.length, 1)

        await cancelPendingAdvance(fixture.campaign.id)

        const afterCancel = await db('characters').where({ campaign_id: fixture.campaign.id, name: 'Créé par le handler' })
        assert.equal(afterCancel.length, 0)
      } finally {
        await cleanup(fixture)
      }
    },
  )
})

test('cancelPendingAdvance : rejoue un INSERT (annule une suppression faite par le handler)', { skip }, async () => {
  await withRegistryEntry(
    {
      key: 'test_cancel_delete',
      interactive: true,
      handler: async (trx, echeance) => {
        const [victim] = await trx('characters')
          .insert({ campaign_id: echeance.campaign_id, name: 'Victime à supprimer' })
          .returning('*')
        await trx('characters').where({ id: victim.id }).del()
        return { resolved: true, reschedule: null, spawn: [], undoEntries: [{ table: 'characters', rowId: victim.id, previousValues: victim }] }
      },
    },
    async () => {
      const fixture = await createRealFixture({ displayed: 1000, resolved: 1000 })
      try {
        const echeance = await createEcheance(db, {
          campaignId: fixture.campaign.id, characterId: fixture.character.id,
          conditionType: 'test_cancel_delete', nextDueMinutes: 1200,
        })
        await requestGameTimeAdvance(fixture.campaign.id, 500)
        await db.transaction((trx) => resolveEcheanceNow(trx, echeance.id))

        assert.equal((await db('characters').where({ campaign_id: fixture.campaign.id, name: 'Victime à supprimer' })).length, 0)

        await cancelPendingAdvance(fixture.campaign.id)

        const restored = await db('characters').where({ campaign_id: fixture.campaign.id, name: 'Victime à supprimer' })
        assert.equal(restored.length, 1)
      } finally {
        await cleanup(fixture)
      }
    },
  )
})

test.after(async () => { await db.destroy() })
