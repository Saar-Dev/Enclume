// Lancement manuel : node --env-file=../../.env --test server/src/chat/chatService.test.mjs
// Même patron que woundReviewService.test.mjs : écritures réelles (pas de rollback), nettoyage
// explicite dans finally. chat_messages a ON DELETE CASCADE sur campaign_id -> supprimer la
// campagne suffit à nettoyer les messages du test.
import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { sendMessage, getHistory, deleteMessage } from './chatService.js'

const skip = !process.env.DATABASE_URL

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `cs-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'cs-gm' })
    .returning('*')
  const [player] = await db('users')
    .insert({ email: `cs-player-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'cs-player' })
    .returning('*')
  const [other] = await db('users')
    .insert({ email: `cs-other-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'cs-other' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test chat', invite_code: `CS-${Date.now()}-${Math.random()}` })
    .returning('*')
  await db('campaign_members').insert([
    { campaign_id: campaign.id, user_id: gm.id, role: 'gm' },
    { campaign_id: campaign.id, user_id: player.id, role: 'player' },
    { campaign_id: campaign.id, user_id: other.id, role: 'player' },
  ])
  return { gm, player, other, campaign }
}

async function cleanup({ campaign, gm, player, other }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
  if (player) await db('users').where({ id: player.id }).del()
  if (other) await db('users').where({ id: other.id }).del()
}

test('sendMessage persiste et renvoie un message enrichi (auteur, couleur)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const msg = await sendMessage({
      campaignId: campaign.id, channelId: 'general', senderUserId: player.id,
      type: 'TEXT', payload: { text: 'Bonjour la table' },
    })
    assert.equal(msg.payload.text, 'Bonjour la table')
    assert.equal(msg.author.id, player.id)
    assert.equal(msg.author.username, 'cs-player')
    assert.ok(msg.id)
  } finally {
    await cleanup(fixture)
  }
})

test('sendMessage sanitize le texte (échappement HTML)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const msg = await sendMessage({
      campaignId: campaign.id, channelId: 'general', senderUserId: player.id,
      type: 'TEXT', payload: { text: '<script>alert(1)</script>' },
    })
    assert.equal(msg.payload.text, '&lt;script&gt;alert(1)&lt;/script&gt;')
  } finally {
    await cleanup(fixture)
  }
})

test('sendMessage rejette un payload invalide (400)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    await assert.rejects(
      sendMessage({
        campaignId: campaign.id, channelId: 'general', senderUserId: player.id,
        type: 'TEXT', payload: { text: '' },
      }),
      (err) => err.statusCode === 400,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('sendMessage applique le rate limit (429 après 10 messages/s)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    for (let i = 0; i < 10; i++) {
      await sendMessage({
        campaignId: campaign.id, channelId: 'general', senderUserId: player.id,
        type: 'TEXT', payload: { text: `msg ${i}` },
      })
    }
    await assert.rejects(
      sendMessage({
        campaignId: campaign.id, channelId: 'general', senderUserId: player.id,
        type: 'TEXT', payload: { text: 'de trop' },
      }),
      (err) => err.statusCode === 429,
    )
  } finally {
    await cleanup(fixture)
  }
})

test('getHistory exclut les messages soft-deleted', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const msg = await sendMessage({
      campaignId: campaign.id, channelId: 'general', senderUserId: player.id,
      type: 'TEXT', payload: { text: 'à supprimer' },
    })
    await deleteMessage(msg.id)
    const history = await getHistory(campaign.id, 'general', { limit: 50 })
    assert.ok(!history.some((m) => m.id === msg.id))
  } finally {
    await cleanup(fixture)
  }
})

test('getHistory sur le canal whisper ne montre que les messages où viewerUserId est expéditeur ou destinataire', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player, other, gm } = fixture
    await sendMessage({
      campaignId: campaign.id, channelId: 'whisper', senderUserId: player.id, recipientUserId: other.id,
      type: 'WHISPER', payload: { text: 'secret A-B', recipientUserId: other.id },
    })
    await sendMessage({
      campaignId: campaign.id, channelId: 'whisper', senderUserId: gm.id, recipientUserId: other.id,
      type: 'WHISPER', payload: { text: 'secret GM-B', recipientUserId: other.id },
    })

    const seenByOther = await getHistory(campaign.id, 'whisper', { viewerUserId: other.id, limit: 50 })
    assert.equal(seenByOther.length, 2)

    const seenByPlayer = await getHistory(campaign.id, 'whisper', { viewerUserId: player.id, limit: 50 })
    assert.equal(seenByPlayer.length, 1)
    assert.equal(seenByPlayer[0].payload.text, 'secret A-B')
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
