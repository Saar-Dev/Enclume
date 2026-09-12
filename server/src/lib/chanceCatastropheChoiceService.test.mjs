import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  openChanceChoice, resolveChanceChoice, listPendingChanceChoices,
} from './chanceCatastropheChoiceService.js'
import { createPendingCatastrophe } from './catastropheService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/chanceCatastropheChoiceService.test.mjs
const skip = !process.env.DATABASE_URL

// fakeIo — même esprit que catastropheService.test.mjs : ces tests vérifient l'état persisté et
// l'idempotence, pas le contenu des broadcasts (couvert manuellement).
const fakeIo = { to: () => ({ emit: () => {} }) }

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `ccc-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'ccc-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test choix Chance', invite_code: `CCC-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Perso test choix Chance', type: 'pj' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  return { gm, campaign, character, charSheet }
}

async function cleanup({ campaign, gm }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
}

// ─── openChanceChoice — crée une ligne en attente, jamais résolue à l'ouverture ──────────────

test('openChanceChoice crée une ligne en attente avec le site et le libellé fournis', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const pending = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test de tir', site: 'entity_displacement', timeoutMs: 60_000,
    })
    assert.ok(pending)
    assert.equal(pending.site, 'entity_displacement')
    assert.equal(pending.test_label, 'Test de tir')
    assert.equal(pending.resolved_at, null)

    const listed = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(listed.length, 1)
    assert.equal(listed[0].id, pending.id)
  } finally {
    await cleanup(fixture)
  }
})

// ─── resolveChanceChoice — idempotence ────────────────────────────────────────────────────────

test('resolveChanceChoice résout une fois, un second appel est un no-op', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const pending = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'entity_displacement', timeoutMs: 60_000,
    })

    const resolved = await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: null })
    assert.ok(resolved)
    assert.ok(resolved.resolved_at)

    const secondAttempt = await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'gain_point' })
    assert.equal(secondAttempt, null, 'déjà résolue — pas d\'application en double')

    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0)
  } finally {
    await cleanup(fixture)
  }
})

// ─── resolveChanceChoice — choix invalide rejeté avant toute écriture ────────────────────────

test('resolveChanceChoice rejette un choix hors du vocabulaire connu, aucune écriture', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const pending = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'entity_displacement', timeoutMs: 60_000,
    })

    await assert.rejects(
      resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'not_a_choice' }),
      /choice invalide/,
    )

    const stillPending = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(stillPending.length, 1)
    assert.equal(stillPending[0].id, pending.id)
  } finally {
    await cleanup(fixture)
  }
})

// ─── resolveChanceChoice('force'/'attempt') — vocabulaire L4 (forçage AOE) accepté, mais SANS
// effet central (contrairement à gain_point/reroll) : l'unique effet vit dans le futur handler
// SITE_HANDLERS.aoe_avoidance, pas ici (PLAN_CHANCE.md §12, décision 2026-09-12). ──────────────

test('resolveChanceChoice accepte "force"/"attempt" sans déclencher de regain ni de retrait', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const pendingForce = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'aoe_avoidance', timeoutMs: 60_000,
    })
    const resolvedForce = await resolveChanceChoice(fakeIo, fixture.campaign.id, pendingForce.id, { choice: 'force' })
    assert.ok(resolvedForce)
    assert.equal(resolvedForce.choice, 'force')

    const pendingAttempt = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'aoe_avoidance', timeoutMs: 60_000,
    })
    const resolvedAttempt = await resolveChanceChoice(fakeIo, fixture.campaign.id, pendingAttempt.id, { choice: 'attempt' })
    assert.ok(resolvedAttempt)
    assert.equal(resolvedAttempt.choice, 'attempt')

    // Aucun effet central : chc inchangé (handleCatastropheRegen n'est appelé que sur 'gain_point').
    const sheet = await db('char_sheet').where({ character_id: fixture.character.id }).first()
    assert.equal(sheet.chc, 11, 'inchangé — force/attempt ne passent jamais par handleCatastropheRegen ici')
  } finally {
    await cleanup(fixture)
  }
})

// ─── resolveChanceChoice('gain_point') — applique réellement le regain via chanceService ────

test('resolveChanceChoice("gain_point") crédite réellement chc via handleCatastropheRegen', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const pending = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'entity_displacement', timeoutMs: 60_000,
    })

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'gain_point' })

    const sheet = await db('char_sheet').where({ character_id: fixture.character.id }).first()
    assert.equal(sheet.chc, 12) // 11 par défaut + 1
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("gain_point") : pas de regain si chc >= 15 (RAW, via handleCatastropheRegen)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('char_sheet').where({ character_id: fixture.character.id }).update({ chc: 16 })
    const pending = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'entity_displacement', timeoutMs: 60_000,
    })

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'gain_point' })

    const sheet = await db('char_sheet').where({ character_id: fixture.character.id }).first()
    assert.equal(sheet.chc, 16, 'inchangé')
  } finally {
    await cleanup(fixture)
  }
})

// ─── Timeout — comportement par défaut, pas de forçage silencieux ───────────────────────────

test('openChanceChoice : timeout résout automatiquement en choice=null (Test normal)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const pending = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'entity_displacement', timeoutMs: 50,
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    const row = await db('pending_chance_choices').where({ id: pending.id }).first()
    assert.ok(row.resolved_at, 'résolue automatiquement par le timeout')
    assert.equal(row.choice, null)

    // Le regain n'a pas eu lieu (choice=null, pas 'gain_point') — chc inchangé.
    const sheet = await db('char_sheet').where({ character_id: fixture.character.id }).first()
    assert.equal(sheet.chc, 11)
  } finally {
    await cleanup(fixture)
  }
})

// ─── resolveChanceChoice('reroll') — annule la Catastrophe combat liée (PLAN_CHANCE.md L3e-4) ──

test('resolveChanceChoice("reroll") retire la pending_catastrophes liée, sans l\'appliquer', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'RESOLUTION' })
    const [battlemap] = await db('battlemaps')
      .insert({ campaign_id: fixture.campaign.id, name: 'Battlemap test' })
      .returning('*')
    const [token] = await db('tokens')
      .insert({ battlemap_id: battlemap.id, label: 'Token test', character_id: fixture.character.id })
      .returning('*')

    const pendingCatastrophe = await createPendingCatastrophe(fakeIo, fixture.campaign.id, token.id, { site: 'test' })
    const pendingChoice = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'unregistered_test_site', timeoutMs: 60_000,
      linkedCatastropheId: pendingCatastrophe.id,
    })

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pendingChoice.id, { choice: 'reroll' })

    const catastropheRow = await db('pending_catastrophes').where({ id: pendingCatastrophe.id }).first()
    assert.ok(catastropheRow.resolved_at, 'retirée')
    assert.equal(catastropheRow.applied_entry, null, 'jamais appliquée')
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("gain_point") ne touche PAS à la Catastrophe liée (reste en attente MJ)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'RESOLUTION' })
    const [battlemap] = await db('battlemaps')
      .insert({ campaign_id: fixture.campaign.id, name: 'Battlemap test' })
      .returning('*')
    const [token] = await db('tokens')
      .insert({ battlemap_id: battlemap.id, label: 'Token test', character_id: fixture.character.id })
      .returning('*')

    const pendingCatastrophe = await createPendingCatastrophe(fakeIo, fixture.campaign.id, token.id, { site: 'test' })
    const pendingChoice = await openChanceChoice(fakeIo, fixture.campaign.id, fixture.character.id, {
      testLabel: 'Test', site: 'unregistered_test_site', timeoutMs: 60_000,
      linkedCatastropheId: pendingCatastrophe.id,
    })

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pendingChoice.id, { choice: 'gain_point' })

    const catastropheRow = await db('pending_catastrophes').where({ id: pendingCatastrophe.id }).first()
    assert.equal(catastropheRow.resolved_at, null, 'toujours en attente de validation MJ')
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
