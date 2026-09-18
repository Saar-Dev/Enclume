import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { applyWound } from './woundService.js'
import { resolveChanceChoice, listPendingChanceChoices } from './chanceCatastropheChoiceService.js'
import './echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (applyWound crée une échéance de guérison à l'insertion)

// Lancement manuel : node --env-file=../.env --test server/src/lib/woundService.test.mjs
//
// Patron fixture réelle + nettoyage explicite (chanceCatastropheChoiceService.test.mjs), PAS le
// patron rollback-trx (woundUtils.test.mjs) : applyWound (paramètre `db`) et openChanceChoice
// (module `db` importé, chanceCatastropheChoiceService.js) touchent deux connexions distinctes —
// un `trx` unique enveloppant les deux ne verrait pas les écritures de l'autre avant commit.
const skip = !process.env.DATABASE_URL

const fakeIo = { to: () => ({ emit: () => {} }) }

async function createFixture() {
  const [user] = await db('users')
    .insert({ email: `wound-svc-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wound-svc-test' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test woundService', invite_code: `WSVC-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Perso test', type: 'pj' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  return { user, campaign, character, charSheet }
}

async function cleanup({ campaign, user }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (user) await db('users').where({ id: user.id }).del()
}

// ─── applyWound — ouvre un choix Chance dès grave+, jamais légère/moyenne ──────────────────────

test('applyWound (Blessure grave) ouvre un choix Chance avec 2 réductions (degré 1 et 2)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    const result = await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    assert.equal(result.finalSeverity, 'grave')

    const pending = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(pending.length, 1)
    assert.equal(pending[0].site, 'wound_severity')
    assert.equal(pending[0].character_id, fixture.character.id) // pj -> destinataire = lui-même
    const context = typeof pending[0].context === 'string' ? JSON.parse(pending[0].context) : pending[0].context
    assert.deepEqual(context.reductions, [
      { degree: 1, targetSeverity: 'moyenne' },
      { degree: 2, targetSeverity: 'legere' },
    ])
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (Blessure moyenne) n\'ouvre aucun choix Chance (RAW : grave+ seulement)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'moyenne',
    })
    const pending = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(pending.length, 0)
  } finally {
    await cleanup(fixture)
  }
})

// ─── applyWound — recalcul base_ini (INI2, RAW REGLESYSCOMBAT.md:111) ──────────────────────────

test('applyWound recalcule base_ini pour un token en combat actif (grave = -5)', { skip }, async () => {
  const fixture = await createFixture()
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: fixture.campaign.id, name: 'BM test woundService' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, character_id: fixture.character.id, label: 'T0' })
    .returning('*')
  await db('combat_roster').insert({
    campaign_id: fixture.campaign.id, token_id: token.id, base_ini: 3, initiative: 3, status: 'active',
  })
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    await applyWound(stubIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const row = await db('combat_roster').where({ token_id: token.id }).first()
    // Aucun char_attributes en fixture -> calcAttributeNA replie sur 3 -> calcREA(3,3,0)=3 ; grave=-5 (WOUND_PENALTIES).
    assert.equal(row.base_ini, 3 + (-5))
    assert.equal(row.initiative, 3, 'initiative en direct jamais retouchée (RAW : effectif au Tour suivant)')
    assert.ok(emitted.some(e => e.event === WS.COMBAT_ROSTER_UPDATED), 'roster rediffusé')
  } finally {
    await db('combat_roster').where({ token_id: token.id }).del()
    await db('tokens').where({ id: token.id }).del()
    await db('battlemaps').where({ id: battlemap.id }).del()
    await cleanup(fixture)
  }
})

test('applyWound hors combat (aucune ligne combat_roster) : no-op silencieux', { skip }, async () => {
  const fixture = await createFixture()
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    const result = await applyWound(stubIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    assert.ok(result, 'la blessure elle-même reste appliquée normalement')
    assert.ok(!emitted.some(e => e.event === WS.COMBAT_ROSTER_UPDATED), 'aucun recalcul hors combat')
  } finally {
    await cleanup(fixture)
  }
})

// ─── finishWoundSeverityChoice — dépense + réduction atomiques ─────────────────────────────────

test('resolveChanceChoice("reduce_1") dépense 1 point de Chance et réduit la Blessure d\'un degré', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 10) // 11 par défaut - 1

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'moyenne')
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("reduce_2") dépense 2 points et réduit la Blessure de deux degrés', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_2' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 9) // 11 - 2

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'legere')
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice(null) (timeout) laisse la Blessure inchangée, aucune dépense', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: null })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 11, 'inchangé')

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'grave', 'inchangée')
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("reduce_1") avec Chance insuffisante : aucun effet, transaction atomique', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 3 }) // plancher RAW
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 3, 'inchangé — jamais sous le plancher')

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'grave', 'inchangée — dépense refusée, réduction jamais appliquée')
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
