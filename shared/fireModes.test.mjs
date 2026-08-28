import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFireModes, firstFireMode } from './fireModes.js'

test('parseFireModes : liste normalisee, ordre canonique CC -> RC -> RL', () => {
  assert.deepEqual(parseFireModes('CC'), ['CC'])
  assert.deepEqual(parseFireModes('CC/RC/RL'), ['CC', 'RC', 'RL'])
  // le catalogue n'ordonne rien — on reordonne
  assert.deepEqual(parseFireModes('RL/CC'), ['CC', 'RL'])
  // insensible a la casse et aux espaces
  assert.deepEqual(parseFireModes(' rc / cc '), ['CC', 'RC'])
})

test('parseFireModes : arme sans mode (arme de contact) -> liste vide', () => {
  assert.deepEqual(parseFireModes(null), [])
  assert.deepEqual(parseFireModes(undefined), [])
  assert.deepEqual(parseFireModes(''), [])
})

test('firstFireMode : mode par defaut = premier de la liste canonique', () => {
  assert.equal(firstFireMode('CC/RC'), 'CC')
  assert.equal(firstFireMode('RC/RL'), 'RC')
  assert.equal(firstFireMode('RL'), 'RL')
  assert.equal(firstFireMode('RL/RC'), 'RC')
  assert.equal(firstFireMode(null), null)
})
