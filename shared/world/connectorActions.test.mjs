import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDoorActionOutcome } from './connectorActions.js'

test('resolveDoorActionOutcome couvre les 6 combinaisons action×état sans ambiguïté', () => {
  assert.equal(resolveDoorActionOutcome('open', 'open'), 'noop')
  assert.equal(resolveDoorActionOutcome('open', 'closed'), 'free')
  assert.equal(resolveDoorActionOutcome('open', 'locked'), 'test')

  assert.equal(resolveDoorActionOutcome('close', 'closed'), 'noop')
  assert.equal(resolveDoorActionOutcome('close', 'locked'), 'noop')
  assert.equal(resolveDoorActionOutcome('close', 'open'), 'free')
})

test('resolveDoorActionOutcome refuse une combinaison inconnue plutôt que de deviner', () => {
  assert.equal(resolveDoorActionOutcome('lock', 'closed'), null)
  assert.equal(resolveDoorActionOutcome('open', 'unknown-state'), null)
  assert.equal(resolveDoorActionOutcome('', ''), null)
})
