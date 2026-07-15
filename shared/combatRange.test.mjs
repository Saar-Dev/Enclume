import test from 'node:test'
import assert from 'node:assert/strict'

import { parseWeaponRangeBands, resolveWeaponRangeBand } from './combatRange.js'

test('parse les cinq bandes Polaris exprimees en metres', () => {
  assert.deepEqual(parseWeaponRangeBands('40/150/300/600 (1 000)'), [40, 150, 300, 600, 1000])
  assert.equal(resolveWeaponRangeBand(40, '40/150/300/600 (1 000)').band, 'bout_portant')
  assert.equal(resolveWeaponRangeBand(151, '40/150/300/600 (1 000)').band, 'moyenne')
  assert.equal(resolveWeaponRangeBand(900, '40/150/300/600 (1 000)').band, 'extreme')
  assert.equal(resolveWeaponRangeBand(1001, '40/150/300/600 (1 000)').status, 'out-of-range')
})

test('une portee unique choisit volontairement la bande la moins favorable', () => {
  assert.equal(resolveWeaponRangeBand(50, '100').band, 'extreme')
})
