import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  computeSeriesPositions, computeActNowPosition,
  pickNextTimelineStep, buildTimelineEntries, endTurn,
} from './combatTurnEngine.js'

// Lancement : node --env-file=server/.env --test server/src/socket/combatTurnEngine.test.mjs
const skip = !process.env.DATABASE_URL

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Couverture du moteur de tour (extrait en M1). M2a = première caractérisation ; M2b a basculé
// `combat_timeline_entries` en file roulante (`resolve_on_turn`, migration 326) et ces tests avec.
// Portée : le noyau requêtable (`pickNextTimelineStep`, `buildTimelineEntries`, `endTurn`) + les 2
// purs. L'orchestration (`startResolutionPhase`/`advanceTimeline` bout en bout) reste couverte par
// le run Saar (harnais io/mods/hazards disproportionné ici).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test.after(async () => { await db.destroy() }) // sinon le pool knex garde le process en vie

const io = { to: () => ({ emit: () => {} }) }
const pendingMaps = { combatTimers: new Map(), combatPreviews: new Map() }
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Crée un combat minimal : user + campagne + battlemap + N tokens + combat_state + N lignes roster.
// `roster` : [{ baseIni, ini?, vitesse?, announced?, resolved? }] (ini défaut = baseIni).
async function createCombatFixture({ turn = 1, phase = 'RESOLUTION', subPhase = 'SLOT_ACTIVE', roster = [] } = {}) {
  const [gm] = await db('users')
    .insert({ email: `turn-engine-${uniq()}@test.local`, password_hash: 'x', username: 'turn-engine-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test combatTurnEngine', invite_code: `TURNENG-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: campaign.id, name: 'BM test' })
    .returning('*')
  await db('combat_state').insert({
    campaign_id: campaign.id, battlemap_id: battlemap.id, phase, current_turn: turn, sub_phase: subPhase,
  })

  const entries = []
  for (const spec of roster) {
    const [character] = await db('characters')
      .insert({ campaign_id: campaign.id, user_id: gm.id, name: `Perso ${entries.length}`, type: 'pj' })
      .returning('*')
    const [token] = await db('tokens')
      .insert({ battlemap_id: battlemap.id, character_id: character.id, label: `T${entries.length}` })
      .returning('*')
    const [rosterRow] = await db('combat_roster')
      .insert({
        campaign_id: campaign.id, token_id: token.id,
        base_ini: spec.baseIni, initiative: spec.ini ?? spec.baseIni,
        status: 'active',
        has_announced: spec.announced ?? true,
        has_resolved: spec.resolved ?? false,
        state_vitesse: spec.vitesse ?? 'normal',
      })
      .returning('*')
    entries.push({ character, token, rosterRow })
  }

  const cleanup = async () => {
    await db('combat_timeline_entries').where({ campaign_id: campaign.id }).del()
    await db('combat_actions').where({ campaign_id: campaign.id }).del()
    await db('combat_roster').where({ campaign_id: campaign.id }).del()
    await db('combat_state').where({ campaign_id: campaign.id }).del()
    await db('tokens').where({ battlemap_id: battlemap.id }).del()
    await db('battlemaps').where({ id: battlemap.id }).del()
    await db('campaigns').where({ id: campaign.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
  return { gm, campaign, battlemap, roster: entries, cleanup }
}

// Insère une combat_action (défaut 'assault') pour un token, renvoie la ligne.
async function addAction(campaignId, tokenId, { type = 'assault', turnNumber = 1, sequence = 3, status = 'pending' } = {}) {
  const [row] = await db('combat_actions')
    .insert({ campaign_id: campaignId, token_id: tokenId, type, action_key: type, sequence, status, turn_number: turnNumber })
    .returning('*')
  return row
}

// ─── Purs ────────────────────────────────────────────────────────────────────────────────────────

test('computeSeriesPositions — étalement RAW -500 par attaque supplémentaire', () => {
  assert.deepEqual(computeSeriesPositions(1000, 1), [1000])
  assert.deepEqual(computeSeriesPositions(1000, 3), [1000, 500, 0])
  assert.deepEqual(computeSeriesPositions(300, 2), [300, -200])
})

test('computeActNowPosition — référence + 100 + Initiative (départage)', () => {
  assert.equal(computeActNowPosition(700, 12), 812)
  assert.equal(computeActNowPosition(0, 0), 100)
})

// ─── buildTimelineEntries ────────────────────────────────────────────────────────────────────────

test('buildTimelineEntries — une entrée par action complexe, position = Initiative ×100', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 15, ini: 15 }, { baseIni: 8, ini: 8 }] })
  try {
    const [t0, t1] = fx.roster
    const a0 = await addAction(fx.campaign.id, t0.token.id)
    const a1 = await addAction(fx.campaign.id, t1.token.id)
    await buildTimelineEntries(io, fx.campaign.id, 1, [a0, a1], fx.roster.map(r => r.rosterRow))

    const rows = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id }).orderBy('phase_position', 'desc')
    assert.equal(rows.length, 2)
    assert.equal(rows[0].phase_position, 1500)
    assert.equal(rows[0].status, 'scheduled')
    assert.equal(rows[0].turn_number, 1)
    assert.equal(rows[0].resolve_on_turn, 1) // entrée normale : résolue dans son Tour (M2b)
    assert.ok(rows[0].declaration_group_id)
    assert.equal(rows[1].phase_position, 800)
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries — série de 3 : positions -500 en -500, position ≤ 0 → lost', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 3, ini: 3 }] })
  try {
    const { token } = fx.roster[0]
    const actions = [await addAction(fx.campaign.id, token.id), await addAction(fx.campaign.id, token.id), await addAction(fx.campaign.id, token.id)]
    await buildTimelineEntries(io, fx.campaign.id, 1, actions, fx.roster.map(r => r.rosterRow))

    const rows = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id }).orderBy('phase_position', 'desc')
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map(r => r.phase_position), [300, -200, -700])
    assert.deepEqual(rows.map(r => r.status), ['scheduled', 'lost', 'lost'])
    assert.equal(new Set(rows.map(r => r.declaration_group_id)).size, 1) // même groupe
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries — Allure « delayed » → entrées delayed_waiting sans position', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 12, ini: 12, vitesse: 'delayed' }] })
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id)
    await buildTimelineEntries(io, fx.campaign.id, 1, [a], fx.roster.map(r => r.rosterRow))
    const [row] = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id })
    assert.equal(row.status, 'delayed_waiting')
    assert.equal(row.phase_position, null)
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries — move/reload/micro ne génèrent aucune entrée', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 10, ini: 10 }] })
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id, { type: 'reload', sequence: 2 })
    await buildTimelineEntries(io, fx.campaign.id, 1, [a], fx.roster.map(r => r.rosterRow))
    const rows = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id })
    assert.equal(rows.length, 0)
  } finally { await fx.cleanup() }
})

// ─── pickNextTimelineStep ────────────────────────────────────────────────────────────────────────

test('pickNextTimelineStep — plus haute phase_position scheduled ; passe à la suivante une fois résolue', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 15, ini: 15, resolved: true }, { baseIni: 8, ini: 8, resolved: true }] })
  try {
    const [t0, t1] = fx.roster
    const a0 = await addAction(fx.campaign.id, t0.token.id)
    const a1 = await addAction(fx.campaign.id, t1.token.id)
    await buildTimelineEntries(io, fx.campaign.id, 1, [a0, a1], fx.roster.map(r => r.rosterRow))

    let step = await pickNextTimelineStep(fx.campaign.id, 1)
    assert.equal(step.kind, 'entry')
    assert.equal(step.position, 1500)
    assert.equal(step.tokenId, t0.token.id)

    await db('combat_timeline_entries').where({ id: step.entry.id }).update({ status: 'resolved' })
    step = await pickNextTimelineStep(fx.campaign.id, 1)
    assert.equal(step.position, 800)
    assert.equal(step.tokenId, t1.token.id)

    await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id }).update({ status: 'resolved' })
    assert.equal(await pickNextTimelineStep(fx.campaign.id, 1), null)
  } finally { await fx.cleanup() }
})

test('pickNextTimelineStep — action simple (roster annoncé, non résolu, sans entrée) vs entrée : la plus haute position gagne', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [
    { baseIni: 20, ini: 20, announced: true, resolved: false }, // simple, position 2000
    { baseIni: 8, ini: 8, announced: true, resolved: true },     // porte l'entrée
  ] })
  try {
    const [tSimple, tEntry] = fx.roster
    const a = await addAction(fx.campaign.id, tEntry.token.id)
    await buildTimelineEntries(io, fx.campaign.id, 1, [a], fx.roster.map(r => r.rosterRow))

    const step = await pickNextTimelineStep(fx.campaign.id, 1)
    assert.equal(step.kind, 'simple')
    assert.equal(step.position, 2000)
    assert.equal(step.tokenId, tSimple.token.id)
  } finally { await fx.cleanup() }
})

test('pickNextTimelineStep (M2b) — filtre `resolve_on_turn` : entrée différée invisible avant son Tour, visible à son Tour', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [{ baseIni: 10, ini: 10, resolved: true }] })
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id, { turnNumber: 1 })
    // Entrée créée au Tour 1, programmée pour le Tour 3 (différé — ce que M3/3d produiront).
    await db('combat_timeline_entries').insert({
      campaign_id: fx.campaign.id, turn_number: 1, resolve_on_turn: 3, token_id: fx.roster[0].token.id,
      combat_action_id: a.id, phase_position: 1000, status: 'scheduled',
    })
    assert.equal(await pickNextTimelineStep(fx.campaign.id, 2), null) // Tour 2 : pas encore son Tour

    const step = await pickNextTimelineStep(fx.campaign.id, 3) // Tour 3 : éligible
    assert.equal(step?.kind, 'entry')
    assert.equal(step.position, 1000)
  } finally { await fx.cleanup() }
})

// ─── endTurn ─────────────────────────────────────────────────────────────────────────────────────

test('endTurn — reset roster, actions pending → skipped, entrées scheduled → skipped, +1 Tour, retour ANNONCE', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 4, roster: [
    { baseIni: 10, ini: 3, vitesse: 'delayed', announced: true, resolved: true },
  ] })
  try {
    const { token } = fx.roster[0]
    const a = await addAction(fx.campaign.id, token.id, { turnNumber: 4 })
    await db('combat_timeline_entries').insert({
      campaign_id: fx.campaign.id, turn_number: 4, resolve_on_turn: 4, token_id: token.id,
      combat_action_id: a.id, phase_position: 300, status: 'scheduled',
    })

    await endTurn(io, fx.campaign.id, pendingMaps)

    const rosterRow = await db('combat_roster').where({ campaign_id: fx.campaign.id }).first()
    assert.equal(rosterRow.initiative, 10)          // = base_ini
    assert.equal(rosterRow.has_announced, false)
    assert.equal(rosterRow.has_resolved, false)
    assert.equal(rosterRow.state_vitesse, 'normal')
    assert.equal(rosterRow.state_cover, 'exposed')

    assert.equal((await db('combat_actions').where({ id: a.id }).first()).status, 'skipped')
    assert.equal((await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id }).first()).status, 'skipped')

    const state = await db('combat_state').where({ campaign_id: fx.campaign.id }).first()
    assert.equal(state.current_turn, 5)
    assert.equal(state.phase, 'ANNOUNCEMENT')
    assert.equal(state.sub_phase, null)
  } finally { await fx.cleanup() }
})

test('endTurn (M2b) — une entrée différée (resolve_on_turn futur) SURVIT au wipe ; une entrée du Tour courant est balayée', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 4, roster: [{ baseIni: 10, ini: 10, resolved: true }] })
  try {
    const { token } = fx.roster[0]
    const aCur = await addAction(fx.campaign.id, token.id, { turnNumber: 4 })
    const aFut = await addAction(fx.campaign.id, token.id, { turnNumber: 4 })
    await db('combat_timeline_entries').insert([
      { campaign_id: fx.campaign.id, turn_number: 4, resolve_on_turn: 4, token_id: token.id, combat_action_id: aCur.id, phase_position: 1000, status: 'scheduled' },
      { campaign_id: fx.campaign.id, turn_number: 4, resolve_on_turn: 5, token_id: token.id, combat_action_id: aFut.id, phase_position: 9999, status: 'scheduled' },
    ])

    await endTurn(io, fx.campaign.id, pendingMaps)

    const cur = await db('combat_timeline_entries').where({ combat_action_id: aCur.id }).first()
    const fut = await db('combat_timeline_entries').where({ combat_action_id: aFut.id }).first()
    assert.equal(cur.status, 'skipped')     // Tour courant → balayée
    assert.equal(fut.status, 'scheduled')   // Tour futur → épargnée (le débloqueur de M3/3d)
  } finally { await fx.cleanup() }
})
