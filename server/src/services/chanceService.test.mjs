import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { spendChancePoints, grantChancePoint, cancelChanceGrant, handleCatastropheRegen } from './chanceService.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/chanceService.test.mjs
const skip = !process.env.DATABASE_URL

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `chc-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'chc-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({
      gm_id: gm.id, name: 'Campagne test Chance', invite_code: `CHC-${Date.now()}-${Math.random()}`,
      settings: {},
    })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Perso test Chance', type: 'pj' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  return { gm, campaign, character, charSheet }
}

async function cleanup({ campaign, gm }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
}

test('spendChancePoints — dépense simple, chc par défaut 11', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const result = await spendChancePoints(fixture.charSheet.id, 2, { reason: 'test' })
    assert.equal(result.chc, 9)

    const row = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(row.chc, 9)
  } finally {
    await cleanup(fixture)
  }
})

test('spendChancePoints — garde refusée sous le plancher (chc - n < 3), aucune écriture', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 4 })

    await assert.rejects(
      () => spendChancePoints(fixture.charSheet.id, 2, { reason: 'test' }),
      /Chance insuffisante/,
    )

    const row = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(row.chc, 4, 'chc inchangé après un rejet')
  } finally {
    await cleanup(fixture)
  }
})

test('spendChancePoints — dépense concurrente sérialisée, jamais sous le plancher', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 5 })

    const results = await Promise.allSettled([
      spendChancePoints(fixture.charSheet.id, 2, { reason: 'concurrent-a' }),
      spendChancePoints(fixture.charSheet.id, 2, { reason: 'concurrent-b' }),
    ])

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')
    assert.equal(fulfilled.length, 1, 'une seule des deux dépenses concurrentes doit réussir')
    assert.equal(rejected.length, 1, 'l\'autre doit être rejetée par la garde du plancher')

    const row = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(row.chc, 3, 'chc = 5 - 2, jamais négatif ni sous le plancher')
  } finally {
    await cleanup(fixture)
  }
})

test('grantChancePoint — regain simple, chc par défaut 11', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const result = await grantChancePoint(fixture.charSheet.id)
    assert.equal(result.chc, 12)
  } finally {
    await cleanup(fixture)
  }
})

test('grantChancePoint — plafond 20, jamais dépassé', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 19 })
    const result = await grantChancePoint(fixture.charSheet.id, 2)
    assert.equal(result.chc, 20)
  } finally {
    await cleanup(fixture)
  }
})

test('cancelChanceGrant — décrémente sans rejeter', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 5 })
    const result = await cancelChanceGrant(fixture.charSheet.id, 2)
    assert.equal(result.chc, 3)
  } finally {
    await cleanup(fixture)
  }
})

test('cancelChanceGrant — clampe sur le plancher 3, jamais un rejet', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 4 })
    const result = await cancelChanceGrant(fixture.charSheet.id, 5)
    assert.equal(result.chc, 3, 'clampé à 3, jamais rejeté ni négatif')
  } finally {
    await cleanup(fixture)
  }
})

test('handleCatastropheRegen — regagne 1 point, chc par défaut 11', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const result = await handleCatastropheRegen(fixture.charSheet.id, { testLabel: 'Test de tir' })
    assert.equal(result.chc, 12)
    assert.equal(result.granted, true)
  } finally {
    await cleanup(fixture)
  }
})

test('handleCatastropheRegen — aucun regain si chc >= 15 (RAW)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 15 })
    const result = await handleCatastropheRegen(fixture.charSheet.id, { testLabel: 'Test' })
    assert.equal(result.chc, 15)
    assert.equal(result.granted, false)

    const row = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(row.chc, 15, 'inchangé')
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
