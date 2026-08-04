import test from 'node:test'
import assert from 'node:assert/strict'

import { POSITION_TRANSITION_COST } from './combatStatePositionCost.js'

test('coûts de transition position — valeurs REGLESYSCOMBAT.md:929-941', () => {
  assert.equal(POSITION_TRANSITION_COST.standing.crouching, -3)
  assert.equal(POSITION_TRANSITION_COST.crouching.standing, -3)
  assert.equal(POSITION_TRANSITION_COST.standing.prone, -5)
  assert.equal(POSITION_TRANSITION_COST.crouching.prone, -5)
  // Se relever (Init -10) — asymétrique avec le -5 pour se jeter à terre/plonger
  assert.equal(POSITION_TRANSITION_COST.prone.standing, -10)
  assert.equal(POSITION_TRANSITION_COST.prone.crouching, -10)
})
