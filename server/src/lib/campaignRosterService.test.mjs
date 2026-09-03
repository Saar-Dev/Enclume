import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { getCampaignRoster } from './campaignRosterService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/campaignRosterService.test.mjs
// getCampaignRoster lit via `db` hors transaction (affichage MJ, jamais une décision serveur) —
// patron "committe puis nettoie explicitement", pas le rollback habituel.
const skip = !process.env.DATABASE_URL

const uniq = () => `${Date.now()}-${Math.random()}`

async function mkUser(tag) {
  const [u] = await db('users')
    .insert({ email: `roster-${tag}-${uniq()}@test.local`, password_hash: 'x', username: `roster-${tag}` })
    .returning('*')
  return u
}

async function mkCampaign(gmId) {
  const [c] = await db('campaigns')
    .insert({ gm_id: gmId, name: 'Campagne roster test', invite_code: `RST-${uniq()}` })
    .returning('*')
  return c
}

async function cleanup({ campaign, vault, users = [] }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (vault) await db('vaults').where({ id: vault.id }).del()
  for (const u of users) if (u) await db('users').where({ id: u.id }).del()
}

test('getCampaignRoster : MJ en dernier sans personnages, joueurs par date d\'arrivée, statut prêt/brouillon', { skip }, async () => {
  const gm = await mkUser('gm')
  const alice = await mkUser('alice')
  const bob = await mkUser('bob')
  const campaign = await mkCampaign(gm.id)
  try {
    // Bob rejoint avant Alice — l'ordre de sortie doit suivre joined_at, pas l'ordre d'insertion.
    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: bob.id, role: 'player', created_at: new Date('2026-01-01') })
    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: alice.id, role: 'player', created_at: new Date('2026-02-01') })
    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: gm.id, role: 'gm', created_at: new Date('2026-01-15') })

    // Alice : un PJ prêt + un drone prêt + un PJ en cours de création (char_sheet non verrouillé)
    const [aliceReady] = await db('characters').insert({ campaign_id: campaign.id, user_id: alice.id, name: 'Krieg', type: 'pj' }).returning('*')
    await db('char_sheet').insert({ character_id: aliceReady.id, wizard_locked_at: new Date() })
    await db('characters').insert({ campaign_id: campaign.id, user_id: alice.id, name: 'Drone-7', type: 'drone' })
    const [aliceDraft] = await db('characters').insert({ campaign_id: campaign.id, user_id: alice.id, name: 'Brouillon', type: 'pj' }).returning('*')
    const [draftSheet] = await db('char_sheet').insert({ character_id: aliceDraft.id }).returning('*')

    // Un PNJ appartenant au MJ — ne doit jamais apparaître (carte MJ sans persos).
    await db('characters').insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Garde', type: 'pnj' })

    const roster = await getCampaignRoster(campaign.id)

    assert.deepEqual(roster.map(r => r.username), ['roster-bob', 'roster-alice', 'roster-gm'])

    const gmCard = roster[2]
    assert.equal(gmCard.role, 'gm')
    assert.deepEqual(gmCard.characters, [])

    const aliceCard = roster[1]
    assert.equal(aliceCard.characters.length, 3)
    const krieg = aliceCard.characters.find(c => c.name === 'Krieg')
    assert.equal(krieg.status, 'ready')
    assert.equal(aliceCard.characters.find(c => c.type === 'drone').status, 'ready')
    const draft = aliceCard.characters.find(c => c.status === 'draft')
    assert.equal(draft.type, 'pj')
    assert.equal(draft.sheetId, draftSheet.id)
    assert.ok(draft.updatedAt)

    assert.deepEqual(roster[0].characters, [])
    assert.equal(roster.every(r => r.stats === null), true)
  } finally {
    await cleanup({ campaign, users: [gm, alice, bob] })
  }
})

test('getCampaignRoster : demandes de transfert Coffre regroupées sous le joueur demandeur', { skip }, async () => {
  const gm = await mkUser('gm')
  const alice = await mkUser('alice')
  const campaign = await mkCampaign(gm.id)
  const [vault] = await db('vaults').insert({ user_id: alice.id }).returning('*')
  try {
    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: gm.id, role: 'gm' })
    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: alice.id, role: 'player' })

    const [vaultChar] = await db('characters').insert({ vault_id: vault.id, user_id: alice.id, name: 'Renn', type: 'pj' }).returning('*')
    await db('vault_transfer_requests').insert({
      vault_character_id: vaultChar.id, target_campaign_id: campaign.id, requested_by: alice.id, status: 'pending',
    })
    // Bruit : une demande déjà traitée ne doit pas ressortir.
    const [vaultChar2] = await db('characters').insert({ vault_id: vault.id, user_id: alice.id, name: 'Vieux', type: 'pj' }).returning('*')
    await db('vault_transfer_requests').insert({
      vault_character_id: vaultChar2.id, target_campaign_id: campaign.id, requested_by: alice.id, status: 'approved',
    })

    const roster = await getCampaignRoster(campaign.id)
    const aliceCard = roster.find(r => r.username === 'roster-alice')
    assert.equal(aliceCard.transferRequests.length, 1)
    assert.equal(aliceCard.transferRequests[0].characterName, 'Renn')
    assert.equal(aliceCard.transferRequests[0].characterType, 'pj')
  } finally {
    await cleanup({ campaign, vault, users: [gm, alice] })
  }
})
