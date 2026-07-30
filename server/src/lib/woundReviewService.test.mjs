import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { getPendingReviewForGm, getPendingRollsForPlayer } from './woundReviewService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/woundReviewService.test.mjs
// getPendingReviewForGm/getPendingRollsForPlayer utilisent `db` (pas `trx`, même raison que
// previewDueEcheances) — patron "committe réellement puis nettoie explicitement", pas le rollback
// habituel (une connexion séparée ne verrait pas des écritures non commitées).
const skip = !process.env.DATABASE_URL

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `wrs-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrs-gm' })
    .returning('*')
  const [player] = await db('users')
    .insert({ email: `wrs-player-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrs-player' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test revue', invite_code: `WRS-${Date.now()}-${Math.random()}` })
    .returning('*')
  await db('campaign_members').insert([
    { campaign_id: campaign.id, user_id: gm.id, role: 'gm' },
    { campaign_id: campaign.id, user_id: player.id, role: 'player' },
  ])
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: player.id, name: 'Perso test revue' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  const [wound] = await db('character_wounds')
    .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'grave', occurred_at_game_minutes: 0 })
    .returning('*')
  return { gm, player, campaign, character, wound }
}

async function cleanup({ campaign, gm, player }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
  if (player) await db('users').where({ id: player.id }).del()
}

test('getPendingReviewForGm : enrichit avec personnage + blessure, filtre statut et condition_type', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, character, wound } = fixture
    const [pending] = await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_healing_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'pending_mj_review',
    }).returning('*')
    // bruit : ne doit jamais apparaître (status actif, ou condition_type hors Blessures)
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_healing_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'active',
    })

    const rows = await getPendingReviewForGm(campaign.id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, pending.id)
    assert.equal(rows[0].characterName, 'Perso test revue')
    assert.equal(rows[0].wound.severity, 'grave')
    assert.equal(rows[0].wound.location, 'corps')
  } finally {
    await cleanup(fixture)
  }
})

test('getPendingReviewForGm : inclut aussi awaiting_player_roll (visibilité MJ sur tout le lot)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, character, wound } = fixture
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    const rows = await getPendingReviewForGm(campaign.id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].status, 'awaiting_player_roll')
  } finally {
    await cleanup(fixture)
  }
})

test('getPendingRollsForPlayer : un joueur ne voit que les jets de son propre personnage', { skip }, async () => {
  const fixture = await createRealFixture()
  let autre
  try {
    const { campaign, character, wound, player } = fixture
    const [autreUser] = await db('users')
      .insert({ email: `wrs-other-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrs-other' })
      .returning('*')
    autre = autreUser

    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: autre.id, role: 'player' })
    const [autreCharacter] = await db('characters')
      .insert({ campaign_id: campaign.id, user_id: autre.id, name: 'Autre perso' })
      .returning('*')

    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: autreCharacter.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })

    const rows = await getPendingRollsForPlayer(campaign.id, player.id, { isGm: false })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].characterId, character.id)
  } finally {
    // ordre important : la campagne (et son cascade campaign_members/characters) doit partir avant
    // l'utilisateur "autre", sinon la FK campaign_members_user_id_foreign bloque la suppression.
    await cleanup(fixture)
    if (autre) await db('users').where({ id: autre.id }).del()
  }
})

test('getPendingRollsForPlayer : un MJ voit tous les jets en attente de la campagne', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, character, wound, gm } = fixture
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    const rows = await getPendingRollsForPlayer(campaign.id, gm.id, { isGm: true })
    assert.equal(rows.length, 1)
  } finally {
    await cleanup(fixture)
  }
})

test('getPendingRollsForPlayer : ne retourne jamais un wound_healing_check (jamais de jet)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, character, wound, player } = fixture
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_healing_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    const rows = await getPendingRollsForPlayer(campaign.id, player.id, { isGm: false })
    assert.equal(rows.length, 0)
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
