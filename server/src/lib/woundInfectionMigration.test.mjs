import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { planLocationInfections, up as convertInfections, down as revertInfections } from '../db/migrations/365_game_echeances_infection_per_location.js'

// Lancement manuel : node --env-file=.env --test server/src/lib/woundInfectionMigration.test.mjs
// Migrations 365 (conversion des infections vivantes : woundId -> location) et 366 (une infection vivante par personnage et localisation).
// Les tests DB tournent dans une transaction annulée : rien n'est persisté.
const skip = !process.env.DATABASE_URL

// ─── Plan de conversion (pur) ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const row = (id, woundId, extra = {}) => ({
  id, character_id: 'perso-1', status: 'active', payload: { woundId, periodesSansSoin: 0, rollResult: null },
  next_due_minutes: 1000, interval_minutes: null, occurrences_remaining: null, created_at: new Date(2026, 8, 1, 0, 0, Number(id.replace(/\D/g, '')) || 0), ...extra,
})
const wound = (id, location, severity) => ({ id, location, severity })
const byId = (...wounds) => Object.fromEntries(wounds.map(w => [w.id, w]))

test('planLocationInfections : une infection par case d\'une même localisation -> UNE gardée (la plus avancée), les autres annulées, périodes et échéance fusionnées', () => {
  const rows = [
    row('e1', 'w1', { payload: { woundId: 'w1', periodesSansSoin: 1, rollResult: null }, next_due_minutes: 3000, interval_minutes: 2880, occurrences_remaining: 3 }),
    row('e2', 'w2', { payload: { woundId: 'w2', periodesSansSoin: 3, rollResult: null }, next_due_minutes: 2000, interval_minutes: 2880, occurrences_remaining: 1, status: 'awaiting_player_roll' }),
    row('e3', 'w3', { next_due_minutes: 4000 }),
  ]
  const plan = planLocationInfections(rows, byId(wound('w1', 'jambe_gauche', 'moyenne'), wound('w2', 'jambe_gauche', 'moyenne'), wound('w3', 'jambe_gauche', 'grave')))
  assert.deepEqual(plan.cancelIds, [])
  assert.equal(plan.keeps.length, 1)
  const [keep] = plan.keeps
  assert.equal(keep.id, 'e2', 'l\'état le plus avancé : jet du joueur attendu')
  assert.deepEqual(new Set(keep.cancelIds), new Set(['e1', 'e3']))
  assert.deepEqual(keep.patch.payload, { periodesSansSoin: 3, rollResult: null, location: 'jambe_gauche' }, 'plus de woundId ; le plus grand nombre de périodes sans soin')
  assert.equal(keep.patch.next_due_minutes, 2000, 'l\'échéance la plus proche')
  assert.equal(keep.patch.interval_minutes, 2880)
  assert.equal(keep.patch.occurrences_remaining, 3, 'le cycle récurrent le plus long')
})

test('planLocationInfections : deux localisations -> deux infections ; à état égal, la pire blessure puis la plus ancienne', () => {
  const rows = [row('e1', 'w1'), row('e2', 'w2'), row('e3', 'w3'), row('e4', 'w4', { character_id: 'perso-2' })]
  const plan = planLocationInfections(rows, byId(
    wound('w1', 'bras_droit', 'moyenne'), wound('w2', 'bras_droit', 'critique'), wound('w3', 'jambe_gauche', 'grave'), wound('w4', 'bras_droit', 'moyenne'),
  ))
  assert.deepEqual(plan.keeps.map(k => k.id).sort(), ['e2', 'e3', 'e4'])
  assert.deepEqual(plan.keeps.find(k => k.id === 'e2').cancelIds, ['e1'], 'la Critique gagne sur la Moyenne')
  assert.equal(plan.keeps.find(k => k.id === 'e4').patch.payload.location, 'bras_droit', 'un autre personnage : jamais fusionné')
})

test('planLocationInfections : blessure disparue, Légère ou Mort en Tête/Corps -> annulée ; Membre détruit -> gardée ; une ponctuelle reste ponctuelle', () => {
  const rows = [row('e1', 'absente'), row('e2', 'w2'), row('e3', 'w3'), row('e4', 'w4'), row('e5', 'w5')]
  const plan = planLocationInfections(rows, byId(
    wound('w2', 'corps', 'legere'), wound('w3', 'tete', 'mort_subite'), wound('w4', 'bras_gauche', 'mort_subite'), wound('w5', 'jambe_droite', 'mortelle'),
  ))
  assert.deepEqual(new Set(plan.cancelIds), new Set(['e1', 'e2', 'e3']))
  assert.deepEqual(plan.keeps.map(k => k.id).sort(), ['e4', 'e5'])
  for (const keep of plan.keeps) {
    assert.equal(keep.patch.interval_minutes, null)
    assert.equal(keep.patch.occurrences_remaining, null)
  }
})

// ─── Conversion réelle, puis retour arrière (transaction annulée) ───────────────────────────────────────────────────────────────────────

async function createFixture(trx) {
  const [user] = await trx('users').insert({ email: `wim-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wim-test' }).returning('*')
  const [campaign] = await trx('campaigns').insert({ gm_id: user.id, name: 'Campagne test migration infections', invite_code: `WIM-${Date.now()}-${Math.random()}` }).returning('*')
  const [character] = await trx('characters').insert({ campaign_id: campaign.id, name: 'Perso test' }).returning('*')
  const [charSheet] = await trx('char_sheet').insert({ character_id: character.id }).returning('*')
  return { campaign, character, charSheet }
}

test('migration 365 : les infections vivantes d\'une case deviennent celles de sa localisation (doublons fusionnés, terminées intactes) ; down() les rattache à la pire blessure', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const woundOf = async (location, severity) => (await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location, severity, occurred_at_game_minutes: 0 }).returning('*'))[0]
    const w1 = await woundOf('jambe_gauche', 'moyenne')
    const w2 = await woundOf('jambe_gauche', 'moyenne')
    const w3 = await woundOf('bras_droit', 'grave')
    const legacy = async (woundId, extra = {}) => (await trx('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_infection_check', interactive: true, advance_driven: true,
      payload: { woundId, periodesSansSoin: 0 }, next_due_minutes: 1000, status: 'active', ...extra,
    }).returning('*'))[0]
    const e1 = await legacy(w1.id)
    const e2 = await legacy(w2.id)
    const e3 = await legacy(w3.id)
    const done = await legacy(w1.id, { status: 'completed' })

    await convertInfections(trx)
    const live = await trx('game_echeances').where({ character_id: character.id, condition_type: 'wound_infection_check' }).whereIn('status', ['active', 'pending_mj_review', 'awaiting_player_roll'])
    assert.deepEqual(live.map(e => e.payload.location).sort(), ['bras_droit', 'jambe_gauche'])
    assert.ok(live.every(e => e.payload.woundId === undefined))
    assert.equal(await trx('game_echeances').where({ id: e3.id }).first().then(e => e.payload.location), 'bras_droit')
    assert.equal([e1, e2].filter(e => live.some(l => l.id === e.id)).length, 1, 'un seul des deux doublons est gardé')
    assert.equal((await trx('game_echeances').where({ id: done.id }).first()).payload.woundId, w1.id, 'une infection terminée garde son ancien payload')

    // Idempotente : rejouée, elle ne change plus rien.
    const snapshot = JSON.stringify(await trx('game_echeances').where({ character_id: character.id }).orderBy('id'))
    await convertInfections(trx)
    assert.equal(JSON.stringify(await trx('game_echeances').where({ character_id: character.id }).orderBy('id')), snapshot)

    await revertInfections(trx)
    const reverted = await trx('game_echeances').where({ character_id: character.id, condition_type: 'wound_infection_check' }).whereIn('status', ['active', 'pending_mj_review', 'awaiting_player_roll'])
    assert.ok(reverted.every(e => e.payload.location === undefined && [w1.id, w2.id, w3.id].includes(e.payload.woundId)))
    throw new Error('ROLLBACK_WIM_TEST')
  }), /ROLLBACK_WIM_TEST/)
})

// ─── Migration 366 : l'index unique ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('migration 366 : deux infections VIVANTES pour le même personnage et la même localisation sont refusées par la base ; une terminée, une autre localisation ou un autre personnage passent', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character } = await createFixture(trx)
    const other = (await trx('characters').insert({ campaign_id: campaign.id, name: 'Autre perso' }).returning('*'))[0]
    const insert = (q, characterId, location, status = 'active') => q('game_echeances').insert({
      campaign_id: campaign.id, character_id: characterId, condition_type: 'wound_infection_check', interactive: true, advance_driven: true,
      payload: { location, periodesSansSoin: 0 }, next_due_minutes: 1000, status,
    })
    await insert(trx, character.id, 'tete')
    await insert(trx, character.id, 'tete', 'completed') // terminée : ne compte pas
    await insert(trx, character.id, 'corps')
    await insert(trx, other.id, 'tete')

    // Le doublon vivant échoue DANS un savepoint : la transaction reste utilisable.
    await assert.rejects(trx.transaction(sp => insert(sp, character.id, 'tete', 'pending_mj_review')), /uq_game_echeances_infection_per_location/)
    throw new Error('ROLLBACK_WIM_TEST')
  }), /ROLLBACK_WIM_TEST/)
})

test.after(async () => { await db.destroy() })
