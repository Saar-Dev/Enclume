import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  startPresence, endPresence, sweepStalePresence,
  logCombatStart, logCombatEnd, getCampaignActivity,
} from './campaignActivityService.js'

// Lancement manuel : node --env-file=../.env --test --test-force-exit server/src/lib/campaignActivityService.test.mjs
const skip = !process.env.DATABASE_URL
const uniq = () => `${Date.now()}-${Math.random()}`

async function mkUser(tag) {
  const [u] = await db('users')
    .insert({ email: `activity-${tag}-${uniq()}@test.local`, password_hash: 'x', username: `act-${tag}` })
    .returning('*')
  return u
}
async function mkCampaign(gmId) {
  const [c] = await db('campaigns')
    .insert({ gm_id: gmId, name: 'Campagne activité test', invite_code: `ACT-${uniq()}` })
    .returning('*')
  return c
}
async function cleanup({ campaign, users = [] }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  for (const u of users) if (u) await db('users').where({ id: u.id }).del()
}
const min = (n) => n * 60 * 1000
const ago = (ms) => new Date(Date.now() - ms)

test('présence : fusion des intervalles (multi-onglets comptés une fois) + split session/wizard + visites', { skip }, async () => {
  const gm = await mkUser('gm')
  const alice = await mkUser('alice')
  const campaign = await mkCampaign(gm.id)
  try {
    // Deux onglets chevauchants : [t-60, t-30] et [t-45, t-20] → union = 40 min, pas 55.
    await db('campaign_presence_sessions').insert([
      { campaign_id: campaign.id, user_id: alice.id, context: 'session', started_at: ago(min(60)), last_seen_at: ago(min(30)), ended_at: ago(min(30)) },
      { campaign_id: campaign.id, user_id: alice.id, context: 'session', started_at: ago(min(45)), last_seen_at: ago(min(20)), ended_at: ago(min(20)) },
      // Reconnexion 5 min plus tard (< gap 10 min) → même visite : [t-15, t-10]
      { campaign_id: campaign.id, user_id: alice.id, context: 'session', started_at: ago(min(15)), last_seen_at: ago(min(10)), ended_at: ago(min(10)) },
      // Wizard, séparé : 12 min
      { campaign_id: campaign.id, user_id: alice.id, context: 'wizard', started_at: ago(min(200)), last_seen_at: ago(min(188)), ended_at: ago(min(188)) },
    ])

    const { presenceByUser } = await getCampaignActivity(campaign.id)
    const a = presenceByUser[alice.id]

    // union session = [t-60,t-20] (40 min) + [t-15,t-10] (5 min) = 45 min
    assert.equal(Math.round(a.sessionSeconds / 60), 45)
    assert.equal(Math.round(a.wizardSeconds / 60), 12)
    // visites : les 3 sessions se regroupent-elles ? [t-60,t-20] puis [t-15,t-10] : gap = 5 min < 10 → 1 visite
    assert.equal(a.visitCount, 1)
    assert.equal(a.online, false)
    assert.ok(a.lastConnectedAt)
  } finally {
    await cleanup({ campaign, users: [gm, alice] })
  }
})

test('présence : deux visites distinctes quand le gap dépasse 10 min ; online reflète une ligne ouverte récente', { skip }, async () => {
  const gm = await mkUser('gm')
  const bob = await mkUser('bob')
  const campaign = await mkCampaign(gm.id)
  try {
    await db('campaign_presence_sessions').insert([
      { campaign_id: campaign.id, user_id: bob.id, context: 'session', started_at: ago(min(120)), last_seen_at: ago(min(100)), ended_at: ago(min(100)) },
      { campaign_id: campaign.id, user_id: bob.id, context: 'session', started_at: ago(min(30)), last_seen_at: ago(min(1)), ended_at: null },
    ])
    const { presenceByUser } = await getCampaignActivity(campaign.id)
    const b = presenceByUser[bob.id]
    assert.equal(b.visitCount, 2)
    assert.equal(b.online, true) // ligne ouverte, last_seen_at il y a 1 min
  } finally {
    await cleanup({ campaign, users: [gm, bob] })
  }
})

test('sweepStalePresence : ferme les lignes ouvertes à ended_at = last_seen_at', { skip }, async () => {
  const gm = await mkUser('gm')
  const carol = await mkUser('carol')
  const campaign = await mkCampaign(gm.id)
  try {
    const [row] = await db('campaign_presence_sessions')
      .insert({ campaign_id: campaign.id, user_id: carol.id, context: 'session', started_at: ago(min(50)), last_seen_at: ago(min(20)), ended_at: null })
      .returning('*')
    const closed = await sweepStalePresence()
    assert.ok(closed >= 1)
    const after = await db('campaign_presence_sessions').where({ id: row.id }).first()
    assert.notEqual(after.ended_at, null)
    assert.equal(new Date(after.ended_at).getTime(), new Date(after.last_seen_at).getTime())
  } finally {
    await cleanup({ campaign, users: [gm, carol] })
  }
})

test('startPresence / endPresence écrivent la ligne', { skip }, async () => {
  const gm = await mkUser('gm')
  const dave = await mkUser('dave')
  const campaign = await mkCampaign(gm.id)
  try {
    const id = await startPresence(campaign.id, dave.id, 'wizard')
    let row = await db('campaign_presence_sessions').where({ id }).first()
    assert.equal(row.context, 'wizard')
    assert.equal(row.ended_at, null)
    await endPresence(id)
    row = await db('campaign_presence_sessions').where({ id }).first()
    assert.notEqual(row.ended_at, null)
  } finally {
    await cleanup({ campaign, users: [gm, dave] })
  }
})

test('combat : logCombatStart/End → compte + durée ; combat ouvert compté sans durée', { skip }, async () => {
  const gm = await mkUser('gm')
  const campaign = await mkCampaign(gm.id)
  try {
    // combat terminé, 8 min
    await db('campaign_combat_log').insert({ campaign_id: campaign.id, started_at: ago(min(60)), ended_at: ago(min(52)) })
    // combat en cours (ouvert)
    await logCombatStart(campaign.id, null)

    let { combat } = await getCampaignActivity(campaign.id)
    assert.equal(combat.combatCount, 2)
    assert.equal(Math.round(combat.combatSeconds / 60), 8) // l'ouvert ne compte pas

    await logCombatEnd(campaign.id)
    ;({ combat } = await getCampaignActivity(campaign.id))
    assert.equal(combat.combatCount, 2)
    assert.ok(combat.combatSeconds >= min(8) / 1000) // le 2e a maintenant une durée
  } finally {
    await cleanup({ campaign, users: [gm] })
  }
})
