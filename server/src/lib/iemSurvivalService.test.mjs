import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { exposeToIemSurvival, resolveIemSurvivalTicks, IEM_SURVIVAL_STATUS_CODE } from './iemSurvivalService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/iemSurvivalService.test.mjs
const skip = !process.env.DATABASE_URL

// Survie I.E.M. (MANUEL_INFORMATIQUE.md §4.7, PLAN_INFORMATIQUE.md §4 Lot 3b). Fixture minimale
// même patron que combatTurnEngine.test.mjs#createCombatFixture — campagne + battlemap +
// combat_state + 1 exo-armure + son token + une ligne combat_roster + un ordinateur exo_computers.
const io = { to: () => ({ emit: () => {} }) }
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

async function createExoFixture({ currentTurn = 5, survieIemCurrent = 10, survieIemMax = 15, sequelleMalus = 0 } = {}) {
  const [gm] = await db('users')
    .insert({ email: `iemsurvival-${uniq()}@test.local`, password_hash: 'x', username: 'iemsurvival-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test iemSurvivalService', invite_code: `IEMSURV-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: campaign.id, name: 'BM test iemSurvivalService' })
    .returning('*')
  await db('combat_state').insert({
    campaign_id: campaign.id, battlemap_id: battlemap.id, phase: 'RESOLUTION', current_turn: currentTurn, sub_phase: 'SLOT_ACTIVE',
  })
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test iemSurvivalService', type: 'exo' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, character_id: exoCharacter.id, label: 'ExoToken' })
    .returning('*')
  await db('combat_roster').insert({
    campaign_id: campaign.id, token_id: token.id, base_ini: 10, initiative: 10, status: 'active',
  })
  const [computer] = await db('exo_computers')
    .insert({
      character_id: exoCharacter.id, role: 'principal', gen: 3, nt: 2,
      survie_iem_current: survieIemCurrent, survie_iem_max: survieIemMax, sequelle_malus: sequelleMalus,
    })
    .returning('*')

  const cleanup = async () => {
    await db('token_statuses').where({ token_id: token.id }).del()
    await db('combat_roster').where({ campaign_id: campaign.id }).del()
    await db('exo_computers').where({ character_id: exoCharacter.id }).del()
    await db('combat_state').where({ campaign_id: campaign.id }).del()
    await db('tokens').where({ battlemap_id: battlemap.id }).del()
    await db('battlemaps').where({ id: battlemap.id }).del()
    await db('campaigns').where({ id: campaign.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
  return { gm, campaign, battlemap, exoCharacter, token, computer, cleanup }
}

const readStatus = (tokenId) => db('token_statuses').where({ token_id: tokenId, status_code: IEM_SURVIVAL_STATUS_CODE }).first()
const readComputer = (id) => db('exo_computers').where({ id }).first()

// ── exposeToIemSurvival ──────────────────────────────────────────────────────
test('exposeToIemSurvival — pose data.rebootEligibleTurn = currentTurn - mr, expires_at_turn NULL', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5 })
  try {
    await exposeToIemSurvival(io, db, fx.campaign.id, fx.token.id, { computerId: fx.computer.id, mr: -3, isCriticalFail: false })
    const row = await readStatus(fx.token.id)
    assert.ok(row, 'ligne posée')
    assert.equal(row.expires_at_turn, null, 'jamais balayée par la purge universelle')
    assert.equal(row.data.rebootEligibleTurn, 8, '5 - (-3) = 8')
    assert.equal(row.data.exoComputerId, fx.computer.id)
    assert.equal(row.data.wasCritical, false)
  } finally { await fx.cleanup() }
})

test('exposeToIemSurvival — échec critique → wasCritical true', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5 })
  try {
    await exposeToIemSurvival(io, db, fx.campaign.id, fx.token.id, { computerId: fx.computer.id, mr: -6, isCriticalFail: true })
    const row = await readStatus(fx.token.id)
    assert.equal(row.data.wasCritical, true)
    assert.equal(row.data.rebootEligibleTurn, 11)
  } finally { await fx.cleanup() }
})

test('exposeToIemSurvival — second échec IEM avant la fin de l\'incident : jamais raccourcir rebootEligibleTurn, jamais perdre wasCritical', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5 })
  try {
    // 1er échec critique, grosse marge → rebootEligibleTurn = 15
    await exposeToIemSurvival(io, db, fx.campaign.id, fx.token.id, { computerId: fx.computer.id, mr: -10, isCriticalFail: true })
    // 2e échec, marge faible, non critique — ne doit RIEN raccourcir ni perdre wasCritical
    await exposeToIemSurvival(io, db, fx.campaign.id, fx.token.id, { computerId: fx.computer.id, mr: -1, isCriticalFail: false })
    const row = await readStatus(fx.token.id)
    assert.equal(row.data.rebootEligibleTurn, 15, 'jamais raccourci (Math.max)')
    assert.equal(row.data.wasCritical, true, 'jamais perdu (OR)')
  } finally { await fx.cleanup() }
})

// ── resolveIemSurvivalTicks ──────────────────────────────────────────────────
test('resolveIemSurvivalTicks — rebootEligibleTurn > currentTurn : ligne inchangée, aucun jet', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 10 })
  try {
    await db('token_statuses').insert({
      token_id: fx.token.id, status_code: IEM_SURVIVAL_STATUS_CODE, expires_at_turn: null,
      data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 8, wasCritical: false },
    })
    await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, [{ token_id: fx.token.id, data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 8, wasCritical: false } }])
    const row = await readStatus(fx.token.id)
    assert.ok(row, 'ligne toujours présente — pas encore le Tour de retenter')
    const computer = await readComputer(fx.computer.id)
    assert.equal(computer.survie_iem_current, 10, 'aucune usure sans tentative')
  } finally { await fx.cleanup() }
})

test('resolveIemSurvivalTicks — survie_iem_current=0 : Test toujours raté (seuil 0 < tout jet 1D20), reste immobile', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 0 })
  try {
    await db('token_statuses').insert({
      token_id: fx.token.id, status_code: IEM_SURVIVAL_STATUS_CODE, expires_at_turn: null,
      data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false },
    })
    const rows = [{ token_id: fx.token.id, data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false } }]
    await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows)
    const row = await readStatus(fx.token.id)
    assert.ok(row, 'ligne toujours présente — Test raté')
    const computer = await readComputer(fx.computer.id)
    assert.equal(computer.survie_iem_current, 0, 'aucune usure sur un échec')
    assert.equal(computer.sequelle_malus, 0, 'aucune séquelle sur un échec (étape 3 seulement si redémarrage réussi)')
  } finally { await fx.cleanup() }
})

test('resolveIemSurvivalTicks — survie_iem_current=25 : redémarrage toujours réussi, ligne supprimée, usure -1, séquelle pair/impair sur 40 tirages', { skip }, async () => {
  for (let i = 0; i < 40; i++) {
    const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 25, sequelleMalus: 0 })
    try {
      await db('token_statuses').insert({
        token_id: fx.token.id, status_code: IEM_SURVIVAL_STATUS_CODE, expires_at_turn: null,
        data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false },
      })
      const rows = [{ token_id: fx.token.id, data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false } }]
      await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows)
      const row = await readStatus(fx.token.id)
      assert.equal(row, undefined, 'ligne supprimée — redémarrage réussi')
      const computer = await readComputer(fx.computer.id)
      assert.equal(computer.survie_iem_current, 24, 'usure -1')
      assert.ok([0, -1].includes(computer.sequelle_malus), `séquelle attendue 0 ou -1, obtenu ${computer.sequelle_malus}`)
    } finally { await fx.cleanup() }
  }
})

test('resolveIemSurvivalTicks — wasCritical=true : séquelle impair vaut -2, jamais -1', { skip }, async () => {
  for (let i = 0; i < 40; i++) {
    const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 25, sequelleMalus: 0 })
    try {
      const rows = [{ token_id: fx.token.id, data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: true } }]
      await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows)
      const computer = await readComputer(fx.computer.id)
      assert.ok([0, -2].includes(computer.sequelle_malus), `séquelle critique attendue 0 ou -2, obtenu ${computer.sequelle_malus}`)
    } finally { await fx.cleanup() }
  }
})

test('resolveIemSurvivalTicks — séquelle cumulative : un ordinateur déjà à -1 devient -2 (ou reste -1), jamais remis à 0', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 25, sequelleMalus: -1 })
  try {
    const rows = [{ token_id: fx.token.id, data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false } }]
    await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows)
    const computer = await readComputer(fx.computer.id)
    assert.ok([-1, -2].includes(computer.sequelle_malus), `attendu -1 (inchangé) ou -2 (nouvelle séquelle), obtenu ${computer.sequelle_malus}`)
  } finally { await fx.cleanup() }
})

test('resolveIemSurvivalTicks — usure plancher à 0, jamais négative', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 25 })
  try {
    // Force survie_iem_current à 0 juste avant le tick (simule le dernier redémarrage possible).
    await db('exo_computers').where({ id: fx.computer.id }).update({ survie_iem_current: 0 })
    // survie_iem_current=0 → Test toujours raté (cf. test dédié ci-dessus) → jamais l'occasion de
    // passer sous 0 par ce chemin ; ce test documente seulement l'invariant Math.max(0, ...) du code.
    const rows = [{ token_id: fx.token.id, data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false } }]
    await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows)
    const computer = await readComputer(fx.computer.id)
    assert.equal(computer.survie_iem_current, 0)
  } finally { await fx.cleanup() }
})

test('resolveIemSurvivalTicks — ordinateur supprimé entre-temps : statut retiré, jamais de crash', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5, survieIemCurrent: 10 })
  try {
    await db('token_statuses').insert({
      token_id: fx.token.id, status_code: IEM_SURVIVAL_STATUS_CODE, expires_at_turn: null,
      data: { exoComputerId: fx.computer.id, rebootEligibleTurn: 5, wasCritical: false },
    })
    const deletedComputerId = fx.computer.id
    await db('exo_computers').where({ id: fx.computer.id }).del()
    const rows = [{ token_id: fx.token.id, data: { exoComputerId: deletedComputerId, rebootEligibleTurn: 5, wasCritical: false } }]
    await resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows)
    const row = await readStatus(fx.token.id)
    assert.equal(row, undefined, 'statut retiré, jamais laissé bloquer le token indéfiniment')
  } finally { await fx.cleanup() }
})

test('resolveIemSurvivalTicks — ligne malformée (data absente) : ignorée, jamais un throw', { skip }, async () => {
  const fx = await createExoFixture({ currentTurn: 5 })
  try {
    const rows = [{ token_id: fx.token.id, data: null }]
    await assert.doesNotReject(() => resolveIemSurvivalTicks(io, db, fx.campaign.id, 5, rows))
  } finally { await fx.cleanup() }
})

test.after(async () => { await db.destroy() })
