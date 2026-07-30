import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FALL_DAMAGE_GROUND_LEVEL, FALL_DAMAGE_TABLE, fallDamageBeyondFourMeters,
  FALL_DAMAGE_TERRAIN_ACCIDENTE_BONUS, FALL_DAMAGE_TEST_MALUS_PER_METER,
  FALL_DAMAGE_TEST_MAX_HEIGHT_METERS, FALL_DAMAGE_TEST_REDUCTION_FORMULA,
} from './fallDamageConstants.js'

test('FALL_DAMAGE_GROUND_LEVEL — RAW "Niveau du sol" (docs/REGLES/FATIGUE&DOMMAGES.md:17-19)', () => {
  assert.deepEqual(FALL_DAMAGE_GROUND_LEVEL, { formula: '1d6', locations: 1 })
})

test('FALL_DAMAGE_TABLE — paliers 1-4m RAW littéraux (FATIGUE&DOMMAGES.md:20-23)', () => {
  assert.deepEqual(FALL_DAMAGE_TABLE[1], { formula: '1d6',  locations: 1 })
  assert.deepEqual(FALL_DAMAGE_TABLE[2], { formula: '1d10', locations: 1 })
  assert.deepEqual(FALL_DAMAGE_TABLE[3], { formula: '2d10', locations: 1 })
  assert.deepEqual(FALL_DAMAGE_TABLE[4], { formula: '3d10', locations: '1d3' })
})

test('fallDamageBeyondFourMeters — simplification (h-1)d10 équivalente à 3d10+1d10x(h-4)', () => {
  assert.deepEqual(fallDamageBeyondFourMeters(4), { formula: '3d10', locations: '1d3+3' })
  assert.deepEqual(fallDamageBeyondFourMeters(5), { formula: '4d10', locations: '1d3+3' })
  assert.deepEqual(fallDamageBeyondFourMeters(10), { formula: '9d10', locations: '1d3+3' })
})

test('FALL_DAMAGE_TERRAIN_ACCIDENTE_BONUS — RAW +1D10 (FATIGUE&DOMMAGES.md:28-30)', () => {
  assert.equal(FALL_DAMAGE_TERRAIN_ACCIDENTE_BONUS, '1d10')
})

test('Test Acrobatie/Équilibre — constantes RAW (FATIGUE&DOMMAGES.md:31-36)', () => {
  assert.equal(FALL_DAMAGE_TEST_MALUS_PER_METER, 2)
  assert.equal(FALL_DAMAGE_TEST_MAX_HEIGHT_METERS, 5)
  assert.equal(FALL_DAMAGE_TEST_REDUCTION_FORMULA, '1d6')
})
