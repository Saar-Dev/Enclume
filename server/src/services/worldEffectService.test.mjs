import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { createWorldEffectInstance, updateWorldEffectInstance, tickWorldEffectInstanceDurations } from './worldEffectService.js'

// Lancement (depuis la racine) : node --env-file=.env --test server/src/services/worldEffectService.test.mjs
// Écrit puis supprime des lignes dans la base locale — sans DATABASE_URL, tout est ignoré.
const skip = !process.env.DATABASE_URL

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const VOLUME = { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } }

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `wes-${uniq()}@test.local`, password_hash: 'x', username: 'wes-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test worldEffectService', invite_code: `WES-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'BM test' }).returning('*')
  return { gm, campaign, battlemap }
}

async function cleanup({ campaign, gm, battlemap }) {
  await db('world_effect_instances').where({ battlemap_id: battlemap.id }).del()
  await db('battlemaps').where({ campaign_id: campaign.id }).del()
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

test.after(async () => { await db.destroy() })

// PLAN_ZONES_DANGER.md §2.H point 4 (Z2 étape 3) — décrément en fin de Tour, expiration à 0. Aucun
// test existant sur worldEffectService.js avant celui-ci (noté §11 historique, Z2 étape 1).
test('tickWorldEffectInstanceDurations — décrémente, expire à 0, laisse les permanentes intactes', { skip }, async () => {
  const fx = await createFixture()
  try {
    const timed2 = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME, durationRounds: 2 },
    })
    const timed1 = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME, durationRounds: 1 },
    })
    const permanent = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME },
    })

    const first = await tickWorldEffectInstanceDurations({ battlemapId: fx.battlemap.id, database: db })
    assert.deepEqual(first.expiredIds, [timed1.instance.id], 'la zone à 1 Tour restant expire dès ce premier tick')

    const rowsAfterFirst = await db('world_effect_instances')
      .where('id', 'in', [timed2.instance.id, timed1.instance.id, permanent.instance.id])
    const byId = Object.fromEntries(rowsAfterFirst.map(r => [r.id, r]))
    assert.equal(byId[timed2.instance.id].duration_rounds, 1)
    assert.equal(byId[timed2.instance.id].state, 'active')
    assert.equal(byId[timed1.instance.id].duration_rounds, 0)
    assert.equal(byId[timed1.instance.id].state, 'expired')
    assert.equal(byId[permanent.instance.id].duration_rounds, null, 'permanente : jamais touchée')
    assert.equal(byId[permanent.instance.id].state, 'active')

    const second = await tickWorldEffectInstanceDurations({ battlemapId: fx.battlemap.id, database: db })
    assert.deepEqual(second.expiredIds, [timed2.instance.id], 'la zone déjà expirée n’est plus considérée (state!==active)')

    const rowsAfterSecond = await db('world_effect_instances').where({ id: timed2.instance.id }).first()
    assert.equal(rowsAfterSecond.state, 'expired')
  } finally {
    await cleanup(fx)
  }
})

test('tickWorldEffectInstanceDurations — runtimeRevision seulement bumpée quand une zone expire réellement', { skip }, async () => {
  const fx = await createFixture()
  try {
    await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME, durationRounds: 5 },
    })
    // Révision APRÈS la création (elle-même bump déjà — bumpRuntimeRevision, worldEffectService.js)
    // : c'est le tick lui-même qu'on isole, pas la création.
    const [battlemapBefore] = await db('battlemaps').where({ id: fx.battlemap.id }).select('runtime_revision')
    const revisionBefore = Number(battlemapBefore.runtime_revision || 0)
    const noExpiry = await tickWorldEffectInstanceDurations({ battlemapId: fx.battlemap.id, database: db })
    assert.deepEqual(noExpiry.expiredIds, [])
    assert.equal(noExpiry.runtimeRevision, revisionBefore, 'aucune expiration : pas de bump (rien à rafraîchir visuellement)')

    await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME, durationRounds: 1 },
    })
    const withExpiry = await tickWorldEffectInstanceDurations({ battlemapId: fx.battlemap.id, database: db })
    assert.equal(withExpiry.expiredIds.length, 1)
    assert.ok(withExpiry.runtimeRevision > revisionBefore, 'une expiration réelle bump bien la révision')
  } finally {
    await cleanup(fx)
  }
})

test('tickWorldEffectInstanceDurations — aucune instance à durée finie : ne fait rien, jamais un throw', { skip }, async () => {
  const fx = await createFixture()
  try {
    await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME },
    })
    const result = await tickWorldEffectInstanceDurations({ battlemapId: fx.battlemap.id, database: db })
    assert.deepEqual(result.expiredIds, [])
  } finally {
    await cleanup(fx)
  }
})

// PLAN_ZONES_DANGER.md §2.E (Z2 étape 4) — `puissance` persiste par la création ET la mise à jour
// d'une instance (migration 368_world_effect_instances_puissance.js).
test('createWorldEffectInstance / updateWorldEffectInstance — puissance persiste (défaut 0, signée, modifiable)', { skip }, async () => {
  const fx = await createFixture()
  try {
    const withoutPuissance = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME },
    })
    assert.equal(withoutPuissance.instance.puissance, 0, 'défaut neutre sans la fournir')

    const withPuissance = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'acide:capsule', targetKind: 'volume', volume: VOLUME, puissance: -2 },
    })
    assert.equal(withPuissance.instance.puissance, -2, 'entier signé — une puissance négative est valide')

    const updated = await updateWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      instanceId: withoutPuissance.instance.id,
      patch: { puissance: 7 },
    })
    assert.equal(updated.instance.puissance, 7)
  } finally {
    await cleanup(fx)
  }
})
