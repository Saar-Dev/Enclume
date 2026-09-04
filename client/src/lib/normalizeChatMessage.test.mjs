import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeMessage } from './normalizeChatMessage.js'

const dicePersisted = {
  id: 254,
  channelId: 'general',
  type: 'DICE',
  payload: {
    userId: 'u1', username: 'Saar', color: '#4A90D9', formula: 'd20', rolls: [14], total: 14,
    isCriticalSuccess: false, isCriticalFail: false, seed: 14, timestamp: '2026-09-04T21:00:00.000Z',
    secret: false,
  },
  author: null,
  character: null,
  recipientUserId: null,
  createdAt: '2026-09-04T21:00:00.123Z',
}

test('un message DICE est aplati et username renommé en user', () => {
  const result = normalizeMessage(dicePersisted)
  assert.equal(result.type, 'dice')
  assert.equal(result.id, 254)
  assert.equal(result.user, 'Saar')
  assert.equal(result.username, undefined)
  assert.equal(result.formula, 'd20')
  assert.deepEqual(result.rolls, [14])
  assert.equal(result.total, 14)
})

test('createdAt est conservé (nécessaire au tri chronologique de l\'appelant)', () => {
  const result = normalizeMessage(dicePersisted)
  assert.equal(result.createdAt, '2026-09-04T21:00:00.123Z')
})

test('time est dérivé de createdAt, pas de payload.timestamp', () => {
  const result = normalizeMessage(dicePersisted)
  assert.equal(typeof result.time, 'string')
  assert.notEqual(result.time.length, 0)
})

test('un message TEXT/WHISPER traverse inchangé', () => {
  const text = { id: 1, type: 'TEXT', payload: { text: 'salut' }, author: { username: 'Saar' } }
  assert.equal(normalizeMessage(text), text)
})
