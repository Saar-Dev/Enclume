import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_FATIGUE_POINTS, FATIGUE_LEVEL_MALUS, FATIGUE_TEST_MALUS, FATIGUE_CHOC_MALUS,
  getFatiguePalier, getFatigueCase, getFatigueLevelMalus, getFatigueTestMalus,
} from './fatigueConstants.js'

test('MAX_FATIGUE_POINTS — 6 paliers x 3 cases (Annexe p.250)', () => {
  assert.equal(MAX_FATIGUE_POINTS, 17)
})

test('getFatiguePalier — bornes des 6 paliers', () => {
  assert.equal(getFatiguePalier(0), 0)
  assert.equal(getFatiguePalier(2), 0)
  assert.equal(getFatiguePalier(3), 1)
  assert.equal(getFatiguePalier(5), 1)
  assert.equal(getFatiguePalier(14), 4)
  assert.equal(getFatiguePalier(15), 5)
  assert.equal(getFatiguePalier(16), 5)
  assert.equal(getFatiguePalier(17), 5)
})

test('getFatigueCase — reste dans le palier', () => {
  assert.equal(getFatigueCase(0), 0)
  assert.equal(getFatigueCase(2), 2)
  assert.equal(getFatigueCase(3), 0)
  assert.equal(getFatigueCase(5), 2)
  assert.equal(getFatigueCase(15), 0)
  assert.equal(getFatigueCase(17), 2)
})

test('getFatigueLevelMalus — barème §4.1 (0/-3/-5/-7/-10/-10)', () => {
  assert.deepEqual(FATIGUE_LEVEL_MALUS, [0, -3, -5, -7, -10, -10])
  assert.equal(getFatigueLevelMalus(0), 0)
  assert.equal(getFatigueLevelMalus(3), -3)
  assert.equal(getFatigueLevelMalus(6), -5)
  assert.equal(getFatigueLevelMalus(9), -7)
  assert.equal(getFatigueLevelMalus(12), -10)
  assert.equal(getFatigueLevelMalus(17), -10)
})

test('getFatigueTestMalus — table Fatigue (paliers 0-4), Annexe p.250', () => {
  assert.deepEqual(FATIGUE_TEST_MALUS, [0, -5, -10])
  assert.equal(getFatigueTestMalus(0), 0)   // Normal, case 0
  assert.equal(getFatigueTestMalus(1), -5)  // Normal, case 1
  assert.equal(getFatigueTestMalus(2), -10) // Normal, case 2
  assert.equal(getFatigueTestMalus(9), 0)   // Très fatigué, case 0
  assert.equal(getFatigueTestMalus(11), -10) // Très fatigué, case 2
})

test('getFatigueTestMalus — table Choc (palier 5 uniquement), Annexe p.250', () => {
  assert.deepEqual(FATIGUE_CHOC_MALUS, [-5, -10, -15])
  assert.equal(getFatigueTestMalus(15), -5)
  assert.equal(getFatigueTestMalus(16), -10)
  assert.equal(getFatigueTestMalus(17), -15)
})
