// Lancement manuel : node --env-file=../../.env --test server/src/chat/chatValidation.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { validateMessagePayload, MAX_TEXT_LENGTH } from './chatValidation.js'

test('accepte un message TEXT valide', () => {
  assert.equal(validateMessagePayload({ type: 'TEXT', payload: { text: 'Bonjour' } }), null)
})

test('rejette un type inconnu', () => {
  assert.match(validateMessagePayload({ type: 'NOPE', payload: { text: 'x' } }), /inconnu/)
})

test('rejette un texte vide ou absent', () => {
  assert.match(validateMessagePayload({ type: 'TEXT', payload: { text: '' } }), /vide/)
  assert.match(validateMessagePayload({ type: 'TEXT', payload: {} }), /manquant/)
})

test('rejette un texte trop long', () => {
  const text = 'a'.repeat(MAX_TEXT_LENGTH + 1)
  assert.match(validateMessagePayload({ type: 'TEXT', payload: { text } }), /dépasse/)
})

test('WHISPER exige recipientUserId', () => {
  assert.match(
    validateMessagePayload({ type: 'WHISPER', payload: { text: 'psst' } }),
    /recipientUserId/,
  )
  assert.equal(
    validateMessagePayload({ type: 'WHISPER', payload: { text: 'psst', recipientUserId: 'u1' } }),
    null,
  )
})
