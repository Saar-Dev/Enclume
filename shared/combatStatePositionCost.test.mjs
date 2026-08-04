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

test('kneeling — alias exact de crouching (décision Saar, RAW ne nomme aucun coût pour "à genou")', () => {
  assert.equal(POSITION_TRANSITION_COST.standing.kneeling, POSITION_TRANSITION_COST.standing.crouching)
  assert.equal(POSITION_TRANSITION_COST.kneeling.standing, POSITION_TRANSITION_COST.crouching.standing)
  assert.equal(POSITION_TRANSITION_COST.kneeling.prone, POSITION_TRANSITION_COST.crouching.prone)
  assert.equal(POSITION_TRANSITION_COST.prone.kneeling, POSITION_TRANSITION_COST.prone.crouching)
  // Seule paire sans mirroir naturel (§0.2bis du plan) — décision distincte, gratuite
  assert.equal(POSITION_TRANSITION_COST.crouching.kneeling, 0)
  assert.equal(POSITION_TRANSITION_COST.kneeling.crouching, 0)
})
