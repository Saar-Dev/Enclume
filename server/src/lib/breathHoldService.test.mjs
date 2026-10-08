import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { calcSouffle } from '../../../shared/polarisUtils.js'
import {
  startBreathHold, resolveHyperventilation, clearBreathHold, resolveBreathHoldTicks,
  BREATH_HOLD_STATUS_CODE, ASPHYXIA_STATUS_CODE,
} from './breathHoldService.js'

// Lancement manuel : node --env-file=.env --test server/src/lib/breathHoldService.test.mjs
const skip = !process.env.DATABASE_URL

const io = { to: () => ({ emit: () => {} }) }
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Même patron que effectLineResolverService.test.mjs : aucune ligne char_attributes insérée —
// calcAttributeNA retombe sur son défaut (NA=3) pour tout attribut absent, suffisant ici (on ne teste
// jamais une valeur de Souffle/seuil Athlétisme précise, seulement la structure/les invariants).
async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `bhs-${uniq()}@test.local`, password_hash: 'x', username: 'bhs-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test breathHoldService', invite_code: `BHS-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'BM test breathHoldService' }).returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Perso test breathHoldService', type: 'pj' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, character_id: character.id, label: 'Token test breathHoldService' })
    .returning('*')
  await db('char_sheet').insert({ character_id: character.id, chc: 3 })
  return { gm, campaign, battlemap, character, token }
}

async function cleanup({ campaign, gm, character, token }) {
  await db('token_statuses').where({ token_id: token.id }).del()
  await db('char_sheet').where({ character_id: character.id }).del()
  await db('tokens').where({ id: token.id }).del()
  await db('characters').where({ id: character.id }).del()
  await db('battlemaps').where({ campaign_id: campaign.id }).del()
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

const readStatus = (tokenId, statusCode) => db('token_statuses').where({ token_id: tokenId, status_code: statusCode }).first()

// ── startBreathHold ──────────────────────────────────────────────────────────
test('startBreathHold — pose breath_hold, data.remaining === data.max === calcSouffle(NA défaut 3,3,0)', { skip }, async () => {
  const fx = await createFixture()
  try {
    const expectedMax = calcSouffle(3, 3, 0)
    const result = await startBreathHold(io, db, fx.campaign.id, fx.token.id)
    assert.equal(result.max, expectedMax)
    const row = await readStatus(fx.token.id, BREATH_HOLD_STATUS_CODE)
    assert.ok(row, 'ligne posée')
    assert.equal(row.expires_at_turn, null, 'jamais balayée par la purge universelle de fin de Tour')
    assert.equal(row.data.max, expectedMax)
    assert.equal(row.data.remaining, expectedMax)
  } finally { await cleanup(fx) }
})

test('startBreathHold — bonus négatif : max jamais sous 0', { skip }, async () => {
  const fx = await createFixture()
  try {
    const result = await startBreathHold(io, db, fx.campaign.id, fx.token.id, { bonus: -999 })
    assert.equal(result.max, 0)
  } finally { await cleanup(fx) }
})

// ── resolveHyperventilation ──────────────────────────────────────────────────
// Invariant structurel valable quel que soit le jet (mr signé négatif sur échec, shared/
// polarisTestResolution.js) : max = calcSouffle(défaut) + mr, dans les deux branches, sans inversion
// de signe supplémentaire ("échec : le modificateur doit être retranché" — déjà vrai par construction
// du signe de mr, RAW docs/REGLES/FATIGUE&DOMMAGES.md:54-57).
test('resolveHyperventilation — pose breath_hold avec max = calcSouffle(défaut) + mr (succès ou échec, 20 tirages)', { skip }, async () => {
  for (let i = 0; i < 20; i++) {
    const fx = await createFixture()
    try {
      const outcome = await resolveHyperventilation(io, db, fx.campaign.id, fx.token.id)
      const row = await readStatus(fx.token.id, BREATH_HOLD_STATUS_CODE)
      assert.ok(row, 'breath_hold posé')
      const expectedMax = Math.max(0, calcSouffle(3, 3, 0) + outcome.mr)
      assert.equal(row.data.max, expectedMax, `roll:${outcome.roll} seuil:${outcome.threshold} mr:${outcome.mr}`)
    } finally { await cleanup(fx) }
  }
})

// ── clearBreathHold ───────────────────────────────────────────────────────────
test('clearBreathHold — retire breath_hold ET asphyxia (peu importe la phase atteinte)', { skip }, async () => {
  const fx = await createFixture()
  try {
    await db('token_statuses').insert([
      { token_id: fx.token.id, status_code: BREATH_HOLD_STATUS_CODE, data: { remaining: 2, max: 5 } },
      { token_id: fx.token.id, status_code: ASPHYXIA_STATUS_CODE, data: { remaining: 3, max: 7 } },
    ])
    await clearBreathHold(io, db, fx.campaign.id, fx.token.id)
    assert.equal(await readStatus(fx.token.id, BREATH_HOLD_STATUS_CODE), undefined)
    assert.equal(await readStatus(fx.token.id, ASPHYXIA_STATUS_CODE), undefined)
  } finally { await cleanup(fx) }
})

// ── resolveBreathHoldTicks ────────────────────────────────────────────────────
test('resolveBreathHoldTicks — breath_hold remaining > 1 : simple décompte, pas de transition', { skip }, async () => {
  const fx = await createFixture()
  try {
    await db('token_statuses').insert({ token_id: fx.token.id, status_code: BREATH_HOLD_STATUS_CODE, data: { remaining: 5, max: 5 } })
    const rows = [{ token_id: fx.token.id, status_code: BREATH_HOLD_STATUS_CODE, data: { remaining: 5, max: 5 } }]
    await resolveBreathHoldTicks(io, db, fx.campaign.id, 1, rows)
    const row = await readStatus(fx.token.id, BREATH_HOLD_STATUS_CODE)
    assert.ok(row, 'toujours en Phase 1')
    assert.equal(row.data.remaining, 4)
    assert.equal(row.data.max, 5, 'max inchangé')
    assert.equal(await readStatus(fx.token.id, ASPHYXIA_STATUS_CODE), undefined)
  } finally { await cleanup(fx) }
})

test('resolveBreathHoldTicks — breath_hold remaining=1 : transition vers asphyxia, 2D6 (2 à 12)', { skip }, async () => {
  for (let i = 0; i < 20; i++) {
    const fx = await createFixture()
    try {
      const rows = [{ token_id: fx.token.id, status_code: BREATH_HOLD_STATUS_CODE, data: { remaining: 1, max: 5 } }]
      await resolveBreathHoldTicks(io, db, fx.campaign.id, 1, rows)
      assert.equal(await readStatus(fx.token.id, BREATH_HOLD_STATUS_CODE), undefined, 'Phase 1 retirée')
      const asphyxiaRow = await readStatus(fx.token.id, ASPHYXIA_STATUS_CODE)
      assert.ok(asphyxiaRow, 'Phase 2 posée')
      assert.ok(asphyxiaRow.data.remaining >= 2 && asphyxiaRow.data.remaining <= 12, `2D6 hors bornes : ${asphyxiaRow.data.remaining}`)
      assert.equal(asphyxiaRow.data.max, asphyxiaRow.data.remaining)
    } finally { await cleanup(fx) }
  }
})

test('resolveBreathHoldTicks — asphyxia remaining > 1 : simple décompte', { skip }, async () => {
  const fx = await createFixture()
  try {
    await db('token_statuses').insert({ token_id: fx.token.id, status_code: ASPHYXIA_STATUS_CODE, data: { remaining: 4, max: 7 } })
    const rows = [{ token_id: fx.token.id, status_code: ASPHYXIA_STATUS_CODE, data: { remaining: 4, max: 7 } }]
    await resolveBreathHoldTicks(io, db, fx.campaign.id, 1, rows)
    const row = await readStatus(fx.token.id, ASPHYXIA_STATUS_CODE)
    assert.equal(row.data.remaining, 3)
  } finally { await cleanup(fx) }
})

test('resolveBreathHoldTicks — asphyxia remaining=1 : transition vers unconscious, sans expiration', { skip }, async () => {
  const fx = await createFixture()
  try {
    const rows = [{ token_id: fx.token.id, status_code: ASPHYXIA_STATUS_CODE, data: { remaining: 1, max: 7 } }]
    await resolveBreathHoldTicks(io, db, fx.campaign.id, 3, rows)
    assert.equal(await readStatus(fx.token.id, ASPHYXIA_STATUS_CODE), undefined, 'Phase 2 retirée')
    const unconsciousRow = await readStatus(fx.token.id, 'unconscious')
    assert.ok(unconsciousRow, 'Phase 3 posée')
    assert.equal(unconsciousRow.expires_at_turn, null, 'réanimation/mort narratives — jamais une expiration Tour')
  } finally { await cleanup(fx) }
})

test.after(async () => { await db.destroy() })
