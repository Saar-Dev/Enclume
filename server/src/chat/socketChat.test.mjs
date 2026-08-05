// Lancement manuel : node --env-file=../../.env --test server/src/chat/socketChat.test.mjs
// io/socket sont mockés (pas de vrai serveur socket.io) : registerChatHandlers ne dépend que de
// io.to/io.in(...).fetchSockets() et socket.on/emit/data, donc un mock fidèle suffit à exercer la
// vraie logique métier (chatService, chatCommands) contre la vraie DB — même patron d'écritures
// réelles + nettoyage explicite que woundReviewService.test.mjs / chatService.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { registerChatHandlers } from './socketChat.js'

const skip = !process.env.DATABASE_URL

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `sc-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'sc-gm' })
    .returning('*')
  const [player] = await db('users')
    .insert({ email: `sc-player-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'sc-player' })
    .returning('*')
  const [other] = await db('users')
    .insert({ email: `sc-other-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'sc-other' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test socketChat', invite_code: `SC-${Date.now()}-${Math.random()}` })
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

// Mock minimal : capture ce que registerChatHandlers appelle réellement (io.to/in, socket.on/emit).
function createMockSocket({ userId, username, role = 'player' }) {
  const handlers = {}
  const emitted = []
  return {
    data: { userId, role },
    on: (event, handler) => { handlers[event] = handler },
    emit: (event, payload) => emitted.push({ event, payload }),
    trigger: (event, payload) => handlers[event](payload),
    emitted,
    userId,
    username,
  }
}

function createMockIo(campaignId, sockets) {
  const roomEmitted = []
  return {
    to: (room) => ({
      emit: (event, payload) => { if (room === campaignId) roomEmitted.push({ event, payload }) },
    }),
    in: (room) => ({
      fetchSockets: async () => (room === campaignId ? sockets : []),
    }),
    roomEmitted,
  }
}

test('chat:send TEXT persiste et diffuse à toute la room', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const playerSocket = createMockSocket({ userId: player.id, username: 'sc-player' })
    const io = createMockIo(campaign.id, [playerSocket])

    registerChatHandlers(io, playerSocket, { campaignId: campaign.id, user: player })
    await playerSocket.trigger('chat:send', { channelId: 'general', type: 'TEXT', payload: { text: 'Bonjour' } })

    assert.equal(io.roomEmitted.length, 1)
    assert.equal(io.roomEmitted[0].event, 'chat:message_created')
    assert.equal(io.roomEmitted[0].payload.payload.text, 'Bonjour')
  } finally {
    await cleanup(fixture)
  }
})

test('chat:send avec un texte vide renvoie chat:error (400), rien diffusé', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const playerSocket = createMockSocket({ userId: player.id, username: 'sc-player' })
    const io = createMockIo(campaign.id, [playerSocket])

    registerChatHandlers(io, playerSocket, { campaignId: campaign.id, user: player })
    await playerSocket.trigger('chat:send', { channelId: 'general', type: 'TEXT', payload: { text: '' } })

    assert.equal(io.roomEmitted.length, 0)
    assert.equal(playerSocket.emitted.length, 1)
    assert.equal(playerSocket.emitted[0].event, 'chat:error')
    assert.equal(playerSocket.emitted[0].payload.code, 400)
  } finally {
    await cleanup(fixture)
  }
})

test('chat:send "/help" renvoie une réponse privée (i18nKey), rien persisté ni diffusé', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const playerSocket = createMockSocket({ userId: player.id, username: 'sc-player' })
    const io = createMockIo(campaign.id, [playerSocket])

    registerChatHandlers(io, playerSocket, { campaignId: campaign.id, user: player })
    await playerSocket.trigger('chat:send', { channelId: 'general', type: 'TEXT', payload: { text: '/help' } })

    assert.equal(io.roomEmitted.length, 0)
    assert.equal(playerSocket.emitted.length, 1)
    assert.equal(playerSocket.emitted[0].payload.i18nKey, 'chat.commands.help.list')
    assert.equal(playerSocket.emitted[0].payload.private, true)
  } finally {
    await cleanup(fixture)
  }
})

test('chat:send "/w" livre uniquement l\'expéditeur et le destinataire, jamais toute la room', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player, other, gm } = fixture
    const playerSocket = createMockSocket({ userId: player.id, username: 'sc-player' })
    const otherSocket = createMockSocket({ userId: other.id, username: 'sc-other' })
    const gmSocket = createMockSocket({ userId: gm.id, username: 'sc-gm', role: 'gm' })
    const io = createMockIo(campaign.id, [playerSocket, otherSocket, gmSocket])

    registerChatHandlers(io, playerSocket, { campaignId: campaign.id, user: player })
    await playerSocket.trigger('chat:send', {
      channelId: 'general', type: 'TEXT', payload: { text: '/w sc-other coucou' },
    })

    assert.equal(io.roomEmitted.length, 0, 'jamais de broadcast room pour un whisper')
    assert.equal(playerSocket.emitted.length, 1)
    assert.equal(playerSocket.emitted[0].payload.payload.text, 'coucou')
    assert.equal(otherSocket.emitted.length, 1)
    assert.equal(otherSocket.emitted[0].payload.payload.text, 'coucou')
    assert.equal(gmSocket.emitted.length, 0, 'le MJ ne doit rien recevoir, il n\'est ni expéditeur ni destinataire')
  } finally {
    await cleanup(fixture)
  }
})

test('chat:send "/nawak" (commande inconnue) renvoie chat:error', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const playerSocket = createMockSocket({ userId: player.id, username: 'sc-player' })
    const io = createMockIo(campaign.id, [playerSocket])

    registerChatHandlers(io, playerSocket, { campaignId: campaign.id, user: player })
    await playerSocket.trigger('chat:send', { channelId: 'general', type: 'TEXT', payload: { text: '/nawak' } })

    assert.equal(io.roomEmitted.length, 0)
    assert.equal(playerSocket.emitted[0].event, 'chat:error')
    assert.match(playerSocket.emitted[0].payload.message, /Commande inconnue/)
  } finally {
    await cleanup(fixture)
  }
})

test('chat:send "/r 1d20" est ignoré par le parseur (flux DICE_ROLL existant conservé, §9/§15)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, player } = fixture
    const playerSocket = createMockSocket({ userId: player.id, username: 'sc-player' })
    const io = createMockIo(campaign.id, [playerSocket])

    registerChatHandlers(io, playerSocket, { campaignId: campaign.id, user: player })
    // "/r 1d20" n'est pas un type TEXT valide en tant que message chat brut ('r 1d20' comme texte
    // normal), donc il est persisté tel quel comme un message TEXT ordinaire — pas intercepté ici.
    await playerSocket.trigger('chat:send', { channelId: 'general', type: 'TEXT', payload: { text: '/r 1d20' } })

    assert.equal(io.roomEmitted.length, 1)
    assert.equal(io.roomEmitted[0].payload.payload.text, '/r 1d20')
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
