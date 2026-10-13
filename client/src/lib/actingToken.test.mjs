// Logique pure, aucune base/DOM — lancement : node --test client/src/lib/actingToken.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveActingToken, getOwnedTokens, getNextOwnedTokenId } from './actingToken.js'

const userId = 'u1'
const gmId = 'gm1'
const pj = { id: 'char-pj', user_id: userId }
const drone = { id: 'char-drone', user_id: userId }
const otherChar = { id: 'char-other', user_id: 'u2' }

const tokenPj = { id: 'tok-pj', character_id: pj.id, layer: 'player' }
const tokenDrone = { id: 'tok-drone', character_id: drone.id, layer: 'player' }
const tokenOther = { id: 'tok-other', character_id: otherChar.id, layer: 'player' }
const tokenGm = { id: 'tok-gm', character_id: null, layer: 'gm' }

const characters = [pj, drone, otherChar]
const tokens = [tokenPj, tokenDrone, tokenOther, tokenGm]

test('getOwnedTokens — ne retourne que les tokens dont le character appartient à userId, ordre stable', () => {
  assert.deepEqual(getOwnedTokens({ tokens, characters, userId }), [tokenPj, tokenDrone])
})

test('getOwnedTokens — aucun token possédé (MJ sans personnage)', () => {
  assert.deepEqual(getOwnedTokens({ tokens, characters, userId: gmId }), [])
})

test('getNextOwnedTokenId — cycle et boucle', () => {
  const owned = [tokenPj, tokenDrone]
  assert.equal(getNextOwnedTokenId({ ownedTokens: owned, currentId: null }), 'tok-pj')
  assert.equal(getNextOwnedTokenId({ ownedTokens: owned, currentId: 'tok-pj' }), 'tok-drone')
  assert.equal(getNextOwnedTokenId({ ownedTokens: owned, currentId: 'tok-drone' }), 'tok-pj')
})

test('getNextOwnedTokenId — currentId sur un token qui n\'est plus possédé (ex. drone détruit) retombe sur le premier', () => {
  const owned = [tokenPj]
  assert.equal(getNextOwnedTokenId({ ownedTokens: owned, currentId: 'tok-drone-disparu' }), 'tok-pj')
})

test('getNextOwnedTokenId — aucun token possédé', () => {
  assert.equal(getNextOwnedTokenId({ ownedTokens: [], currentId: null }), null)
})

test('resolveActingToken — 1 seul token possédé, comportement inchangé quelle que soit la sélection/pilotage', () => {
  const singleOwnerTokens = [tokenPj, tokenOther, tokenGm]
  const result = resolveActingToken({
    tokens: singleOwnerTokens, characters, userId, selectedTokenId: 'tok-other', preferredOwnedTokenId: null, isGm: false,
  })
  assert.equal(result, tokenPj)
})

test('resolveActingToken — 2+ tokens possédés sans preferredOwnedTokenId : premier possédé (comportement par défaut, avant Tab)', () => {
  const result = resolveActingToken({
    tokens, characters, userId, selectedTokenId: null, preferredOwnedTokenId: null, isGm: false,
  })
  assert.equal(result, tokenPj)
})

test('resolveActingToken — 2+ tokens possédés, preferredOwnedTokenId désigne le drone : bascule (Tab)', () => {
  const result = resolveActingToken({
    tokens, characters, userId, selectedTokenId: null, preferredOwnedTokenId: 'tok-drone', isGm: false,
  })
  assert.equal(result, tokenDrone)
})

test('resolveActingToken — selectedTokenId (clic) sur un token possédé ne doit JAMAIS primer sur preferredOwnedTokenId (Tab)', () => {
  // Le joueur pilote le drone (Tab) mais vient de cliquer sur son PJ (ex. pour un menu) —
  // la caméra/l'acteur doivent rester sur le drone, pas basculer sur le PJ cliqué.
  const result = resolveActingToken({
    tokens, characters, userId, selectedTokenId: 'tok-pj', preferredOwnedTokenId: 'tok-drone', isGm: false,
  })
  assert.equal(result, tokenDrone)
})

test('resolveActingToken — preferredOwnedTokenId pointant vers un token non possédé (ou disparu) : repli sur le premier possédé', () => {
  const result = resolveActingToken({
    tokens, characters, userId, selectedTokenId: null, preferredOwnedTokenId: 'tok-other', isGm: false,
  })
  assert.equal(result, tokenPj)
})

test('resolveActingToken — aucun token possédé (MJ), selectedTokenId désigne un PNJ : repli sélection (étape 2, inchangé)', () => {
  const result = resolveActingToken({
    tokens, characters, userId: gmId, selectedTokenId: 'tok-other', preferredOwnedTokenId: null, isGm: true,
  })
  assert.equal(result, tokenOther)
})

test('resolveActingToken — MJ, rien sélectionné : null (étape 3 ignorée pour un MJ)', () => {
  const result = resolveActingToken({
    tokens, characters, userId: gmId, selectedTokenId: null, preferredOwnedTokenId: null, isGm: true,
  })
  assert.equal(result, null)
})

test('resolveActingToken — joueur sans aucun token possédé ni sélection : repli sur le premier token non-MJ', () => {
  const result = resolveActingToken({
    tokens, characters, userId: 'u-sans-token', selectedTokenId: null, preferredOwnedTokenId: null, isGm: false,
  })
  assert.equal(result, tokenPj)
})
