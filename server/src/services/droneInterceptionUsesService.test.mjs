import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { currentCombatTurn, engageInterception, getInterceptionUses } from './droneInterceptionUsesService.js'

// Test d'intégration du compteur d'interceptions (Lot 3, CRD). Nécessite la base : lancer avec
//   node --env-file=.env --test server/src/services/droneInterceptionUsesService.test.mjs
// Il ne touche AUCUNE donnée réelle : il travaille sur des tables TEMPORAIRES de la session (elles masquent
// `combat_state` et `drone_interception_uses` le temps de la transaction) et annule la transaction à la fin.
// Il ne dépend donc pas des migrations 360-361 : il vérifie le comportement de la requête atomique.

const campaign = '11111111-1111-1111-1111-111111111111'
const droneA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const droneB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const ROLLBACK = new Error('rollback')

after(() => db.destroy())

async function inTemporaryCombat(body) {
  await db.transaction(async (trx) => {
    await trx.raw('create temp table combat_state (campaign_id uuid primary key, current_turn integer not null) on commit drop')
    await trx.raw(`create temp table drone_interception_uses (
      campaign_id uuid not null, drone_character_id uuid not null, turn_number integer not null,
      uses smallint not null, updated_at timestamptz not null default now(),
      primary key (campaign_id, drone_character_id, turn_number),
      check (turn_number >= 1), check (uses >= 1)) on commit drop`)
    await body(trx)
    throw ROLLBACK
  }).catch((error) => { if (error !== ROLLBACK) throw error })
}

test('hors combat : aucun Tour, aucun compteur, aucune écriture', async () => {
  await inTemporaryCombat(async (trx) => {
    assert.equal(await currentCombatTurn(campaign, trx), null)
    assert.deepEqual(await engageInterception(campaign, droneA, 4, trx), { status: 'no_combat' })
    assert.equal((await getInterceptionUses(campaign, [droneA], trx)).size, 0)
    assert.equal((await trx('drone_interception_uses').count('* as n').first()).n, '0')
  })
})

test('rangs 1 à 4 puis saturé, sans jamais dépasser le plafond', async () => {
  await inTemporaryCombat(async (trx) => {
    await trx('combat_state').insert({ campaign_id: campaign, current_turn: 1 })
    const results = []
    for (let i = 0; i < 4; i++) results.push(await engageInterception(campaign, droneA, 4, trx))
    assert.deepEqual(results, [1, 2, 3, 4].map(rank => ({ status: 'engaged', rank })))
    assert.deepEqual(await engageInterception(campaign, droneA, 4, trx), { status: 'saturated' })
    assert.deepEqual(await engageInterception(campaign, droneA, 4, trx), { status: 'saturated' })
    assert.equal((await trx('drone_interception_uses').where({ drone_character_id: droneA }).first()).uses, 4)
  })
})

test('chaque drone a son compteur et son plafond', async () => {
  await inTemporaryCombat(async (trx) => {
    await trx('combat_state').insert({ campaign_id: campaign, current_turn: 1 })
    for (let i = 0; i < 4; i++) await engageInterception(campaign, droneA, 4, trx)
    const uses = await getInterceptionUses(campaign, [droneA, droneB], trx)
    assert.equal(uses.get(droneA), 4)
    assert.equal(uses.has(droneB), false)
    assert.deepEqual(await engageInterception(campaign, droneB, 2, trx), { status: 'engaged', rank: 1 })
    assert.deepEqual(await engageInterception(campaign, droneB, 2, trx), { status: 'engaged', rank: 2 })
    assert.deepEqual(await engageInterception(campaign, droneB, 2, trx), { status: 'saturated' })
  })
})

test('le Tour suivant repart de zéro sans aucune remise à zéro : le Tour est dans la clé', async () => {
  await inTemporaryCombat(async (trx) => {
    await trx('combat_state').insert({ campaign_id: campaign, current_turn: 1 })
    for (let i = 0; i < 4; i++) await engageInterception(campaign, droneA, 4, trx)
    await trx('combat_state').where({ campaign_id: campaign }).update({ current_turn: 2 })
    assert.equal((await getInterceptionUses(campaign, [droneA], trx)).size, 0)
    assert.deepEqual(await engageInterception(campaign, droneA, 4, trx), { status: 'engaged', rank: 1 })
    assert.equal((await trx('drone_interception_uses').where({ drone_character_id: droneA }).count('* as n').first()).n, '2')
  })
})

test('un plafond abaissé en cours de Tour sature aussitôt', async () => {
  await inTemporaryCombat(async (trx) => {
    await trx('combat_state').insert({ campaign_id: campaign, current_turn: 1 })
    await engageInterception(campaign, droneA, 4, trx)
    assert.deepEqual(await engageInterception(campaign, droneA, 1, trx), { status: 'saturated' })
  })
})

test('un plafond invalide est une erreur, jamais un engagement silencieux', async () => {
  await inTemporaryCombat(async (trx) => {
    await trx('combat_state').insert({ campaign_id: campaign, current_turn: 1 })
    for (const bad of [0, -1, 2.5, null, undefined]) {
      await assert.rejects(engageInterception(campaign, droneA, bad, trx), RangeError)
    }
  })
})
