import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import {
  computeSeriesPositions, computeActNowPosition,
  pickNextTimelineStep, buildTimelineEntries, endTurn,
  advanceTimeline, registerAutonomousStepResolver,
  findNextAnnounceSlot, advanceAnnouncementQueue, prefillAutonomousDroneOrders,
  getDeclarationBlockedTokens, hasActionableToken,
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
// `roster` : [{ baseIni, ini?, vitesse?, announced?, resolved?, type?, userId? }] (ini défaut = baseIni,
// type défaut 'pj' — Sprint 2d ajoute 'drone' pour prefillAutonomousDroneOrders ; userId défaut gm.id,
// passer `null` explicitement pour simuler un drone SANS propriétaire joueur — style PNJ,
// drone_turn_model_gm — cf. DroneWindow.jsx#handleOwnerChange qui ne propose jamais le compte du MJ).
async function createCombatFixture({ turn = 1, phase = 'RESOLUTION', subPhase = 'SLOT_ACTIVE', roster = [], droneTurnModelGm, droneTurnModelPlayer } = {}) {
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
    ...(droneTurnModelGm ? { drone_turn_model_gm: droneTurnModelGm } : {}),
    ...(droneTurnModelPlayer ? { drone_turn_model_player: droneTurnModelPlayer } : {}),
  })

  const entries = []
  for (const spec of roster) {
    const [character] = await db('characters')
      .insert({ campaign_id: campaign.id, user_id: spec.userId !== undefined ? spec.userId : gm.id, name: `Perso ${entries.length}`, type: spec.type ?? 'pj' })
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
async function addAction(campaignId, tokenId, { type = 'assault', turnNumber = 1, sequence = 3, status = 'pending', actionKey = type } = {}) {
  const [row] = await db('combat_actions')
    .insert({ campaign_id: campaignId, token_id: tokenId, type, action_key: actionKey, sequence, status, turn_number: turnNumber })
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

// ─── M3 — Initiative ≤ 0 → Action reportée au Tour suivant (RAW REGLESYSCOMBAT:354) ───────────────

test('buildTimelineEntries (M3) — Initiative ≤ 0 → entrée reportée au Tour+1, action bumpée', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 4, roster: [{ baseIni: 12, ini: 0 }] }) // base 12, Préparations → ini 0
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id, { turnNumber: 4 })
    await buildTimelineEntries(io, fx.campaign.id, 4, [a], fx.roster.map(r => r.rosterRow))

    const [row] = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id })
    assert.equal(row.status, 'scheduled')       // pas 'lost'
    assert.equal(row.turn_number, 4)            // provenance
    assert.equal(row.resolve_on_turn, 5)        // reporté au Tour suivant
    assert.equal(row.phase_position, 1_000_000 + 12 * 100) // CARRY_OVER_BASE + base_ini×100, idx 0
    assert.deepEqual(row.resolution_snapshot, { carriedFrom: 4 })

    const action = await db('combat_actions').where({ id: a.id }).first()
    assert.equal(action.turn_number, 5)         // bumpée → survit au wipe + trouvée par le PRECHECK T+1
    assert.equal(action.status, 'pending')
  } finally { await fx.cleanup() }
})

// Alerte chat du report : source = report RÉEL (Initiative ≤ 0), jamais `resolution_snapshot != null` qui porte
// aussi `{ autoResolve: true }` (drone `drone_auto`) — un drone annonçait « Action reportée » à chaque combat.
function noticeCollectorIo() {
  const notices = []
  return { notices, io: { to: () => ({ emit: (event, data) => { if (event === WS.COMBAT_SYSTEM_NOTICE) notices.push(data) } }) } }
}

test('buildTimelineEntries (M3) — drone_auto (autoResolve) : aucune alerte « Action reportée »', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 3, roster: [{ baseIni: 12, ini: 12, type: 'drone' }] })
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id, { turnNumber: 3, actionKey: 'drone_auto' })
    const { io: capIo, notices } = noticeCollectorIo()
    await buildTimelineEntries(capIo, fx.campaign.id, 3, [a], fx.roster.map(r => r.rosterRow))

    const [row] = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id })
    assert.deepEqual(row.resolution_snapshot, { autoResolve: true }) // le snapshot existe bien…
    assert.equal(row.resolve_on_turn, 3)                             // …mais rien n'est reporté
    assert.deepEqual(notices, [])                                    // donc aucune alerte
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries (M3) — report réel : une seule alerte session.actionCarriedOver', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 4, roster: [{ baseIni: 12, ini: 0 }] })
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id, { turnNumber: 4 })
    const { io: capIo, notices } = noticeCollectorIo()
    await buildTimelineEntries(capIo, fx.campaign.id, 4, [a], fx.roster.map(r => r.rosterRow))

    assert.equal(notices.length, 1)
    assert.equal(notices[0].i18nKey, 'session.actionCarriedOver')
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries (M3) — série de 3 avec Initiative ≤ 0 : toute la série reportée, même groupe', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [{ baseIni: 10, ini: -2 }] })
  try {
    const { token } = fx.roster[0]
    const actions = [await addAction(fx.campaign.id, token.id, { turnNumber: 2 }), await addAction(fx.campaign.id, token.id, { turnNumber: 2 }), await addAction(fx.campaign.id, token.id, { turnNumber: 2 })]
    await buildTimelineEntries(io, fx.campaign.id, 2, actions, fx.roster.map(r => r.rosterRow))

    const rows = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id }).orderBy('phase_position', 'desc')
    assert.equal(rows.length, 3)
    assert.ok(rows.every(r => r.status === 'scheduled' && r.resolve_on_turn === 3))
    assert.deepEqual(rows.map(r => r.phase_position), [1_000_000 + 1000, 1_000_000 + 500, 1_000_000]) // base 10×100 - idx×500
    assert.equal(new Set(rows.map(r => r.declaration_group_id)).size, 1)
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries (M3) — série dont SEULE une attaque supplémentaire déborde (positions[0] > 0) → reste lost, PAS de report', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 1, roster: [{ baseIni: 5, ini: 5 }] }) // positions [500, 0, -500]
  try {
    const { token } = fx.roster[0]
    const actions = [await addAction(fx.campaign.id, token.id), await addAction(fx.campaign.id, token.id), await addAction(fx.campaign.id, token.id)]
    await buildTimelineEntries(io, fx.campaign.id, 1, actions, fx.roster.map(r => r.rosterRow))

    const rows = await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id }).orderBy('phase_position', 'desc')
    assert.deepEqual(rows.map(r => r.status), ['scheduled', 'lost', 'lost'])
    assert.ok(rows.every(r => r.resolve_on_turn === 1 && r.resolution_snapshot == null))
  } finally { await fx.cleanup() }
})

test('buildTimelineEntries (M3) — idempotence : une action déjà porteuse d\'entrée ne recrée rien', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 3, roster: [{ baseIni: 8, ini: 8 }] })
  try {
    const a = await addAction(fx.campaign.id, fx.roster[0].token.id, { turnNumber: 3 })
    await buildTimelineEntries(io, fx.campaign.id, 3, [a], fx.roster.map(r => r.rosterRow))
    await buildTimelineEntries(io, fx.campaign.id, 3, [a], fx.roster.map(r => r.rosterRow)) // 2ᵉ appel
    assert.equal((await db('combat_timeline_entries').where({ campaign_id: fx.campaign.id })).length, 1)
  } finally { await fx.cleanup() }
})

test('endTurn (M3) — token reporté marqué has_announced ; action reportée non skippée ; entrée survit', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 6, roster: [{ baseIni: 9, ini: 0, announced: true, resolved: true }] })
  try {
    const { token } = fx.roster[0]
    const a = await addAction(fx.campaign.id, token.id, { turnNumber: 6 })
    await buildTimelineEntries(io, fx.campaign.id, 6, [a], fx.roster.map(r => r.rosterRow)) // → entrée reportée T7, action bumpée T7

    await endTurn(io, fx.campaign.id, pendingMaps)

    const rosterRow = await db('combat_roster').where({ campaign_id: fx.campaign.id }).first()
    assert.equal(rosterRow.has_announced, true) // reporté → ne redéclare pas
    assert.equal(rosterRow.initiative, 9)       // reset base_ini quand même

    assert.equal((await db('combat_actions').where({ id: a.id }).first()).status, 'pending') // pas skippée
    assert.equal((await db('combat_timeline_entries').where({ combat_action_id: a.id }).first()).status, 'scheduled') // survit

    // Tour 7 : l'entrée reportée est le pas courant, en premier
    const step = await pickNextTimelineStep(fx.campaign.id, 7)
    assert.equal(step?.kind, 'entry')
    assert.equal(step.tokenId, token.id)
    assert.ok(step.position >= 1_000_000)
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

// ─── Lot 0 — findNextAnnounceSlot / advanceAnnouncementQueue (docs/PLANS/PLAN_DRONE.md §4) ─────────
// Centralisation de la requête « prochain slot ANNONCE », dupliquée avant ce Lot dans 5 sites
// (skipPlayer, endTurn, COMBAT_ACTION_DECLARE, COMBAT_ANNOUNCE_START, garde de déclaration) + une
// 6ᵉ variante bugguée (COMBAT_SURPRISE_RESULT échec) qui ne diffusait jamais le slot suivant.
// L'orchestration de `startResolutionPhase` (branche count===0) reste hors périmètre ici, même
// principe que pour `advanceTimeline` plus haut — couverte par le run Saar, pas dupliquée en unitaire.

test('findNextAnnounceSlot — tri base_ini ASC puis token_id ASC, ignore has_announced=true', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [
    { baseIni: 15, announced: false },
    { baseIni: 5, announced: true },   // déjà annoncé → exclu malgré l'Initiative la plus basse
    { baseIni: 8, announced: false },
  ] })
  try {
    const slot = await findNextAnnounceSlot(fx.campaign.id)
    assert.equal(slot.token_id, fx.roster[2].token.id) // baseIni 8, le plus bas parmi les non-annoncés
  } finally { await fx.cleanup() }
})

test('findNextAnnounceSlot — personne à déclarer → undefined (knex .first(), pas de wrapping)', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 10, announced: true }] })
  try {
    assert.equal(await findNextAnnounceSlot(fx.campaign.id), undefined)
  } finally { await fx.cleanup() }
})

test('advanceAnnouncementQueue — au moins un non-annoncé → émet COMBAT_SLOT_ADVANCED pour le bon token, ne bascule pas la phase', { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', roster: [
    { baseIni: 12, announced: false },
    { baseIni: 6, announced: false },
  ] })
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    await advanceAnnouncementQueue(stubIo, fx.campaign.id, pendingMaps)
    assert.equal(emitted.length, 1)
    assert.equal(emitted[0].event, WS.COMBAT_SLOT_ADVANCED)
    assert.equal(emitted[0].payload.tokenId, fx.roster[1].token.id) // baseIni 6, le plus bas
    const state = await db('combat_state').where({ campaign_id: fx.campaign.id }).first()
    assert.equal(state.phase, 'ANNOUNCEMENT') // pas de transition tant qu'il reste un non-annoncé
  } finally { await fx.cleanup() }
})

// ─── advanceAnnouncementQueue — PNJ surpris résolu à SON tour, pas à COMBAT_START (retour Saar
// 2026-09-18, surpriseService.js) : baseIni=20 (Seuil max) → succès garanti (diceRoll 1-20 toujours
// ≤ 20), baseIni=0 → échec garanti (aucun jet ne peut être ≤ 0), déterministe sans mocker le dé.
test('advanceAnnouncementQueue — PNJ surpris, Test réussi (baseIni=20, garanti) : résolu et présenté normalement', { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', roster: [
    { baseIni: 20, announced: false, type: 'pnj', userId: null },
  ] })
  const pnjTokenId = fx.roster[0].token.id
  await db('combat_roster').where({ token_id: pnjTokenId }).update({ is_surprised: true })
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    await advanceAnnouncementQueue(stubIo, fx.campaign.id, pendingMaps)

    const dice = emitted.find(e => e.event === WS.DICE_RESULT)
    assert.ok(dice, 'DICE_RESULT émis pour le PNJ')
    assert.equal(dice.payload.cardType, 'surprise')
    assert.equal(dice.payload.isSuccess, true)

    const slot = emitted.find(e => e.event === WS.COMBAT_SLOT_ADVANCED)
    assert.ok(slot, 'toujours présenté au MJ (Test réussi → déclaration normale)')
    assert.equal(slot.payload.tokenId, pnjTokenId)

    const row = await db('combat_roster').where({ token_id: pnjTokenId }).first()
    assert.ok(row.surprise_roll >= 1 && row.surprise_roll <= 20)
    assert.equal(row.initiative, row.surprise_roll) // succès sans critique : mr === diceRoll
    assert.equal(row.has_announced, false) // reste à déclarer, pas auto-skip
  } finally { await fx.cleanup() }
})

test('advanceAnnouncementQueue — PNJ surpris, Test échoué (baseIni=0, garanti) : auto-skip, ré-avance vers le vrai prochain slot', { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', roster: [
    { baseIni: 0, announced: false, type: 'pnj', userId: null }, // PNJ surpris — sera résolu en premier (baseIni le plus bas)
    { baseIni: 15, announced: false }, // reste à présenter une fois le PNJ auto-skip
  ] })
  const pnjTokenId = fx.roster[0].token.id
  const otherTokenId = fx.roster[1].token.id
  await db('combat_roster').where({ token_id: pnjTokenId }).update({ is_surprised: true })
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    await advanceAnnouncementQueue(stubIo, fx.campaign.id, pendingMaps)

    const dice = emitted.find(e => e.event === WS.DICE_RESULT)
    assert.ok(dice, 'DICE_RESULT émis pour le PNJ malgré l\'échec')
    assert.equal(dice.payload.isSuccess, false)

    const slot = emitted.find(e => e.event === WS.COMBAT_SLOT_ADVANCED)
    assert.ok(slot, 'ré-avance jusqu\'au vrai prochain slot présentable')
    assert.equal(slot.payload.tokenId, otherTokenId, 'jamais le PNJ déjà résolu/clos')

    const pnjRow = await db('combat_roster').where({ token_id: pnjTokenId }).first()
    assert.equal(pnjRow.initiative, 0)
    assert.equal(pnjRow.has_announced, true) // auto-skip, ne peut pas agir ce Tour (RAW)

    const skipAction = await db('combat_actions').where({ token_id: pnjTokenId, action_key: 'skip' }).first()
    assert.ok(skipAction, 'trace explicite (combat_actions) — même patron que l\'échec PJ')
  } finally { await fx.cleanup() }
})

// ─── Sprint 2d — prefillAutonomousDroneOrders (docs/PLANS/PLAN_DRONE.md §4) ────────────────────────
// Réglage différencié MJ/joueur (retour Saar en testant, 2026-09-17) : `drone_turn_model_gm` régit un
// drone sans propriétaire joueur (`userId: null`, style PNJ) ; `drone_turn_model_player` un drone
// assigné à un joueur (`userId` défaut = gm.id dans le fixture, peu importe lequel — seul compte
// non-null vs null, cf. commentaire createCombatFixture).

test('prefillAutonomousDroneOrders — mode classique (les deux réglages) → no-op complet (zéro effet)', { skip }, async () => {
  const fx = await createCombatFixture({ droneTurnModelGm: 'classique', droneTurnModelPlayer: 'classique', roster: [
    { baseIni: 12, announced: false, type: 'drone', userId: null },
    { baseIni: 12, announced: false, type: 'drone' }, // player-owned
  ] })
  try {
    await prefillAutonomousDroneOrders(io, fx.campaign.id, 1)
    const rosterRows = await db('combat_roster').where({ campaign_id: fx.campaign.id })
    assert.ok(rosterRows.every(r => r.has_announced === false))
    assert.equal((await db('combat_actions').where({ campaign_id: fx.campaign.id })).length, 0)
  } finally { await fx.cleanup() }
})

test('prefillAutonomousDroneOrders — ordres_permanents (joueur) : drone joueur pré-annoncé, drone MJ classique et PJ non affectés', { skip }, async () => {
  const fx = await createCombatFixture({ droneTurnModelGm: 'classique', droneTurnModelPlayer: 'ordres_permanents', roster: [
    { baseIni: 12, announced: false, type: 'drone', userId: null }, // drone MJ — reste classique
    { baseIni: 12, announced: false, type: 'drone' },                // drone joueur — ordres permanents
    { baseIni: 8,  announced: false, type: 'pj' },
  ] })
  try {
    const [gmDroneEntry, playerDroneEntry, pjEntry] = fx.roster
    await prefillAutonomousDroneOrders(io, fx.campaign.id, 3)

    assert.equal((await db('combat_roster').where({ token_id: gmDroneEntry.token.id }).first()).has_announced, false)
    assert.equal((await db('combat_roster').where({ token_id: playerDroneEntry.token.id }).first()).has_announced, true)
    assert.equal((await db('combat_roster').where({ token_id: pjEntry.token.id }).first()).has_announced, false)

    const actions = await db('combat_actions').where({ campaign_id: fx.campaign.id })
    assert.equal(actions.length, 1)
    assert.equal(actions[0].token_id, playerDroneEntry.token.id)
    assert.equal(actions[0].action_key, 'drone_auto')
    assert.equal(actions[0].type, 'assault')
    assert.equal(actions[0].turn_number, 3)
    assert.equal(actions[0].status, 'pending')
  } finally { await fx.cleanup() }
})

test('prefillAutonomousDroneOrders — ordres_permanents (MJ) : drone MJ pré-annoncé, drone joueur classique non affecté', { skip }, async () => {
  const fx = await createCombatFixture({ droneTurnModelGm: 'ordres_permanents', droneTurnModelPlayer: 'classique', roster: [
    { baseIni: 12, announced: false, type: 'drone', userId: null }, // drone MJ — ordres permanents
    { baseIni: 12, announced: false, type: 'drone' },                // drone joueur — reste classique
  ] })
  try {
    const [gmDroneEntry, playerDroneEntry] = fx.roster
    await prefillAutonomousDroneOrders(io, fx.campaign.id, 1)

    assert.equal((await db('combat_roster').where({ token_id: gmDroneEntry.token.id }).first()).has_announced, true)
    assert.equal((await db('combat_roster').where({ token_id: playerDroneEntry.token.id }).first()).has_announced, false)

    const actions = await db('combat_actions').where({ campaign_id: fx.campaign.id })
    assert.equal(actions.length, 1)
    assert.equal(actions[0].token_id, gmDroneEntry.token.id)
  } finally { await fx.cleanup() }
})

test('prefillAutonomousDroneOrders — drone déjà annoncé (télépiloté ce Tour) → pas re-préposé', { skip }, async () => {
  const fx = await createCombatFixture({ droneTurnModelPlayer: 'ordres_permanents', roster: [
    { baseIni: 12, announced: true, type: 'drone' },
  ] })
  try {
    await prefillAutonomousDroneOrders(io, fx.campaign.id, 1)
    assert.equal((await db('combat_actions').where({ campaign_id: fx.campaign.id })).length, 0)
  } finally { await fx.cleanup() }
})

// ─── advanceTimeline — suspend d'un résolveur autonome (Sprint 2d) ne doit pas continuer l'échelle ──

test('advanceTimeline — un résolveur autonome qui retourne { suspend: true } arrête la récursion', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 5, roster: [{ baseIni: 9, ini: 9, announced: true, resolved: true }] })
  const calls = []
  registerAutonomousStepResolver(async (io2, cid, step) => {
    calls.push(step.entry.id)
    await db('combat_timeline_entries').where({ id: step.entry.id }).update({ status: 'resolved' })
    return { suspend: true }
  })
  try {
    const { token } = fx.roster[0]
    const a = await addAction(fx.campaign.id, token.id, { turnNumber: 5 })
    await db('combat_timeline_entries').insert({
      campaign_id: fx.campaign.id, turn_number: 5, resolve_on_turn: 5, token_id: token.id,
      combat_action_id: a.id, phase_position: 900, status: 'scheduled',
      resolution_snapshot: JSON.stringify({ autoResolve: true }),
    })

    await advanceTimeline(io, fx.campaign.id, pendingMaps)

    assert.equal(calls.length, 1) // appelé une seule fois — pas de récursion après suspend
    const state = await db('combat_state').where({ campaign_id: fx.campaign.id }).first()
    assert.equal(state.phase, 'RESOLUTION') // endTurn n'a pas été atteint (aurait basculé ANNOUNCEMENT)
  } finally {
    registerAutonomousStepResolver(null)
    await fx.cleanup()
  }
})

// ─── advanceTimeline — résolution autonome (3d : explosion de grenade différée) ────────────────────

test('advanceTimeline (3d) — entrée `autoResolve` : le moteur appelle le résolveur injecté et enchaîne l\'échelle', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 3, roster: [{ baseIni: 12, ini: 12, announced: true, resolved: true }] })
  const calls = []
  // Dans CE process de test, socketCombatResolution.js n'est jamais importé → le résolveur réel n'est
  // pas enregistré (null). On installe un stub, on le retire au finally.
  registerAutonomousStepResolver(async (io2, cid, step) => {
    calls.push(step.entry.id)
    await db('combat_timeline_entries').where({ id: step.entry.id }).update({ status: 'resolved' }) // termine la récursion
  })
  try {
    const { token } = fx.roster[0]
    const aBoom = await addAction(fx.campaign.id, token.id, { turnNumber: 3 })
    const aNormal = await addAction(fx.campaign.id, token.id, { turnNumber: 3 })
    await db('combat_timeline_entries').insert([
      { campaign_id: fx.campaign.id, turn_number: 3, resolve_on_turn: 3, token_id: token.id, combat_action_id: aBoom.id, phase_position: 5000, status: 'scheduled', resolution_snapshot: JSON.stringify({ autoResolve: true, resolvedOrigin: { x: 1, y: 0, z: 2 } }) },
      { campaign_id: fx.campaign.id, turn_number: 3, resolve_on_turn: 3, token_id: token.id, combat_action_id: aNormal.id, phase_position: 1200, status: 'scheduled' },
    ])

    await advanceTimeline(io, fx.campaign.id, pendingMaps)

    assert.equal(calls.length, 1)                    // le résolveur autonome a été appelé une fois
    assert.equal(calls[0], (await db('combat_timeline_entries').where({ combat_action_id: aBoom.id }).first()).id)
    assert.equal((await db('combat_timeline_entries').where({ combat_action_id: aBoom.id }).first()).status, 'resolved')
    assert.equal((await db('combat_timeline_entries').where({ combat_action_id: aNormal.id }).first()).status, 'scheduled') // l'échelle a enchaîné sur l'entrée normale, pas résolue
  } finally {
    registerAutonomousStepResolver(null) // ne pas laisser le stub fuiter vers les autres tests
    await fx.cleanup()
  }
})

// ─── Lot 1c — blocage PROACTIF des tokens bloqués (docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md) ─────────
// Un token mort/étourdi/inconscient est passé PAR LE MOTEUR (annonce : `skipPlayer` ; résolution :
// `forfeitToken`) avant qu'aucune fenêtre ne s'ouvre. Mode 'enforced' seulement (défaut de campagne).

test("hasActionableToken (pur) — vrai s'il reste un acteur non bloqué, faux sinon", () => {
  assert.equal(hasActionableToken(['a', 'b'], new Map([['a', 'dead']])), true)
  assert.equal(hasActionableToken(['a', 'b'], new Map([['a', 'dead'], ['b', 'stunned']])), false)
  assert.equal(hasActionableToken([], new Map()), false)
  assert.equal(hasActionableToken(['a'], new Set()), true)
})

// Pose un statut bloquant sur un token de la fixture (nettoyé par `cleanup1c`).
async function setStatus(tokenId, statusCode) {
  await db('token_statuses').insert({ token_id: tokenId, status_code: statusCode })
}
async function cleanup1c(fx) {
  const tokenIds = fx.roster.map(r => r.token.id)
  await db('combat_pending').where({ campaign_id: fx.campaign.id }).del()
  await db('token_statuses').whereIn('token_id', tokenIds).del()
  await fx.cleanup()
}
const recordingIo = (emitted) => ({ to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) })

test('getDeclarationBlockedTokens — statut du registre + étourdissement en attente ; vide hors mode enforced', { skip }, async () => {
  const fx = await createCombatFixture({ roster: [{ baseIni: 1 }, { baseIni: 2 }, { baseIni: 3 }] })
  try {
    const [t0, t1, t2] = fx.roster.map(r => r.token.id)
    await setStatus(t0, 'dead')
    await db('combat_pending').insert({ campaign_id: fx.campaign.id, token_id: t1, type: 'stun', payload: {} })
    const enforced = await getDeclarationBlockedTokens(fx.campaign.id, [t0, t1, t2], { status_effects_mode: 'enforced' })
    assert.deepEqual([...enforced.entries()].sort(), [[t0, 'dead'], [t1, 'stunned']].sort())
    const iconOnly = await getDeclarationBlockedTokens(fx.campaign.id, [t0, t1, t2], { status_effects_mode: 'icon_only' })
    assert.equal(iconOnly.size, 0)
  } finally { await cleanup1c(fx) }
})

test("advanceAnnouncementQueue (1c) — token mort à son slot : passé SANS fenêtre, slot suivant présenté, « X a été passé » émis", { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', subPhase: null, roster: [
    { baseIni: 5, announced: false }, { baseIni: 10, announced: false }, { baseIni: 15, announced: false },
  ] })
  const emitted = []
  try {
    const [dead, next] = fx.roster.map(r => r.token.id)
    await setStatus(dead, 'dead')
    await advanceAnnouncementQueue(recordingIo(emitted), fx.campaign.id, pendingMaps)

    const slots = emitted.filter(e => e.event === WS.COMBAT_SLOT_ADVANCED)
    assert.equal(slots.length, 1)
    assert.equal(slots[0].payload.tokenId, next)                       // le mort n'a JAMAIS de fenêtre
    const skipped = emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED)
    assert.equal(skipped.length, 1)
    assert.equal(skipped[0].payload.tokenId, dead)
    const row = await db('combat_roster').where({ campaign_id: fx.campaign.id, token_id: dead }).first()
    assert.equal(row.has_announced, true)
    assert.ok(await db('combat_actions').where({ campaign_id: fx.campaign.id, token_id: dead, type: 'skip' }).first())
  } finally { await cleanup1c(fx) }
})

test('advanceAnnouncementQueue (1c) — mode icon_only : comportement inchangé, le mort a sa fenêtre', { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', subPhase: null, roster: [
    { baseIni: 5, announced: false }, { baseIni: 10, announced: false },
  ] })
  const emitted = []
  try {
    await db('campaigns').where({ id: fx.campaign.id }).update({ settings: JSON.stringify({ status_effects_mode: 'icon_only' }) })
    const dead = fx.roster[0].token.id
    await setStatus(dead, 'dead')
    await advanceAnnouncementQueue(recordingIo(emitted), fx.campaign.id, pendingMaps)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 0)
    assert.equal(emitted.find(e => e.event === WS.COMBAT_SLOT_ADVANCED).payload.tokenId, dead)
  } finally { await cleanup1c(fx) }
})

test('advanceAnnouncementQueue (1c) — TOUS bloqués : garde-fou anti-boucle, slot présenté comme avant', { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', subPhase: null, roster: [
    { baseIni: 5, announced: false }, { baseIni: 10, announced: false },
  ] })
  const emitted = []
  try {
    await setStatus(fx.roster[0].token.id, 'dead')
    await setStatus(fx.roster[1].token.id, 'unconscious')
    await advanceAnnouncementQueue(recordingIo(emitted), fx.campaign.id, pendingMaps)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 0)
    assert.equal(emitted.find(e => e.event === WS.COMBAT_SLOT_ADVANCED).payload.tokenId, fx.roster[0].token.id)
  } finally { await cleanup1c(fx) }
})

test("advanceAnnouncementQueue (1c) — mort + drone en ordres permanents seulement : pas d'acteur humain → pas de passage automatique", { skip }, async () => {
  const fx = await createCombatFixture({ phase: 'ANNOUNCEMENT', subPhase: null, roster: [
    { baseIni: 5, announced: false }, { baseIni: 12, announced: true, type: 'drone' },
  ] })
  const emitted = []
  try {
    await setStatus(fx.roster[0].token.id, 'dead')
    await addAction(fx.campaign.id, fx.roster[1].token.id, { actionKey: 'drone_auto' })
    await advanceAnnouncementQueue(recordingIo(emitted), fx.campaign.id, pendingMaps)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 0)
    assert.equal(emitted.find(e => e.event === WS.COMBAT_SLOT_ADVANCED).payload.tokenId, fx.roster[0].token.id)
  } finally { await cleanup1c(fx) }
})

test("advanceTimeline (1c) — pas d'un token mort passé SANS fenêtre : le pas suivant est diffusé, un seul « X a été passé »", { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [
    { baseIni: 20, ini: 20 }, { baseIni: 10, ini: 10 },
  ] })
  const emitted = []
  try {
    const [dead, alive] = fx.roster.map(r => r.token.id)
    await setStatus(dead, 'dead')
    await advanceTimeline(recordingIo(emitted), fx.campaign.id, pendingMaps)

    const timeline = emitted.filter(e => e.event === WS.COMBAT_TIMELINE_UPDATED)
    assert.equal(timeline.length, 1)                                    // aucune fenêtre pour le mort
    assert.equal(timeline[0].payload.currentStep.tokenId, alive)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 1)
    assert.equal((await db('combat_roster').where({ campaign_id: fx.campaign.id, token_id: dead }).first()).has_resolved, true)
  } finally { await cleanup1c(fx) }
})

test("advanceTimeline (1c) — déjà passé à l'annonce (action skip) : pas de doublon « X a été passé »", { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [
    { baseIni: 20, ini: 20 }, { baseIni: 10, ini: 10 },
  ] })
  const emitted = []
  try {
    const [dead, alive] = fx.roster.map(r => r.token.id)
    await setStatus(dead, 'dead')
    await addAction(fx.campaign.id, dead, { type: 'skip', actionKey: 'skip', sequence: 99, status: 'skipped', turnNumber: 2 })
    await advanceTimeline(recordingIo(emitted), fx.campaign.id, pendingMaps)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 0)
    assert.equal(emitted.find(e => e.event === WS.COMBAT_TIMELINE_UPDATED).payload.currentStep.tokenId, alive)
  } finally { await cleanup1c(fx) }
})

test("advanceTimeline (1c) — entrée d'échelle d'un token mort : clôturée (lost), action résolue, pas suivant diffusé", { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [
    { baseIni: 20, ini: 20 }, { baseIni: 10, ini: 10 },
  ] })
  const emitted = []
  try {
    const [dead, alive] = fx.roster.map(r => r.token.id)
    await setStatus(dead, 'dead')
    const action = await addAction(fx.campaign.id, dead, { turnNumber: 2 })
    await buildTimelineEntries(io, fx.campaign.id, 2, [action], fx.roster.map(r => r.rosterRow))
    await advanceTimeline(recordingIo(emitted), fx.campaign.id, pendingMaps)

    assert.equal((await db('combat_timeline_entries').where({ combat_action_id: action.id }).first()).status, 'lost')
    assert.equal((await db('combat_actions').where({ id: action.id }).first()).status, 'resolved')
    assert.equal(emitted.find(e => e.event === WS.COMBAT_TIMELINE_UPDATED).payload.currentStep.tokenId, alive)
  } finally { await cleanup1c(fx) }
})

test('advanceTimeline (1c) — mode icon_only : le pas du mort est présenté comme avant', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [{ baseIni: 20, ini: 20 }, { baseIni: 10, ini: 10 }] })
  const emitted = []
  try {
    await db('campaigns').where({ id: fx.campaign.id }).update({ settings: JSON.stringify({ status_effects_mode: 'icon_only' }) })
    const dead = fx.roster[0].token.id
    await setStatus(dead, 'dead')
    await advanceTimeline(recordingIo(emitted), fx.campaign.id, pendingMaps)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 0)
    assert.equal(emitted.find(e => e.event === WS.COMBAT_TIMELINE_UPDATED).payload.currentStep.tokenId, dead)
  } finally { await cleanup1c(fx) }
})

test('advanceTimeline (1c) — TOUS bloqués : garde-fou anti-boucle, le pas est présenté comme avant', { skip }, async () => {
  const fx = await createCombatFixture({ turn: 2, roster: [{ baseIni: 20, ini: 20 }, { baseIni: 10, ini: 10 }] })
  const emitted = []
  try {
    await setStatus(fx.roster[0].token.id, 'dead')
    await setStatus(fx.roster[1].token.id, 'stunned')
    await advanceTimeline(recordingIo(emitted), fx.campaign.id, pendingMaps)
    assert.equal(emitted.filter(e => e.event === WS.COMBAT_TURN_SKIPPED).length, 0)
    assert.equal(emitted.find(e => e.event === WS.COMBAT_TIMELINE_UPDATED).payload.currentStep.tokenId, fx.roster[0].token.id)
  } finally { await cleanup1c(fx) }
})
