import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COLD_TIERS, isColdTier, isValidColdExposureInput, computeColdIntervalMinutes,
} from './coldExposureConstants.js'

test('COLD_TIERS — 3 tranches de base (Froid extrême n\'en est pas une 4e)', () => {
  assert.deepEqual(COLD_TIERS, ['froid', 'tres_froid', 'glacial'])
})

test('isColdTier', () => {
  assert.equal(isColdTier('froid'), true)
  assert.equal(isColdTier('glacial'), true)
  assert.equal(isColdTier('froid_extreme'), false)
  assert.equal(isColdTier(undefined), false)
})

test('isValidColdExposureInput — extremeSteps refusé hors tier glacial', () => {
  assert.equal(isValidColdExposureInput({ tier: 'froid', extremeSteps: 0, wet: false }), true)
  assert.equal(isValidColdExposureInput({ tier: 'froid', extremeSteps: 1, wet: false }), false)
  assert.equal(isValidColdExposureInput({ tier: 'tres_froid', extremeSteps: 2, wet: true }), false)
  assert.equal(isValidColdExposureInput({ tier: 'glacial', extremeSteps: 2, wet: true }), true)
})

test('isValidColdExposureInput — bornes/types invalides', () => {
  assert.equal(isValidColdExposureInput({ tier: 'glacial', extremeSteps: -1, wet: false }), false)
  assert.equal(isValidColdExposureInput({ tier: 'glacial', extremeSteps: 1.5, wet: false }), false)
  assert.equal(isValidColdExposureInput({ tier: 'nawak', extremeSteps: 0, wet: false }), false)
  assert.equal(isValidColdExposureInput({ tier: 'glacial', extremeSteps: 0, wet: 'oui' }), false)
})

test('computeColdIntervalMinutes — cadence de base par tranche (Test)', () => {
  assert.equal(computeColdIntervalMinutes({ tier: 'froid', extremeSteps: 0, wet: false }, 'test'), 120)
  assert.equal(computeColdIntervalMinutes({ tier: 'tres_froid', extremeSteps: 0, wet: false }, 'test'), 60)
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 0, wet: false }, 'test'), 30)
})

test('computeColdIntervalMinutes — humidité divise par deux', () => {
  assert.equal(computeColdIntervalMinutes({ tier: 'froid', extremeSteps: 0, wet: true }, 'test'), 60)
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 0, wet: true }, 'test'), 15)
})

test('computeColdIntervalMinutes — Froid extrême double le diviseur par palier', () => {
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 1, wet: false }, 'test'), 15)
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 2, wet: false }, 'test'), 7)
})

test('computeColdIntervalMinutes — jamais fractionnaire ni sous 1 (passe 3 point 1)', () => {
  // 30 / 2^1 / 2 (humide) = 7.5 brut — doit être un entier ≥ 1, pas 7.5
  const v = computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 1, wet: true }, 'test')
  assert.equal(Number.isInteger(v), true)
  assert.equal(v >= 1, true)
  assert.equal(v, 7)
  // Cas extrême : diviseur énorme, doit rester plancher à 1, jamais 0
  const v2 = computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 10, wet: true }, 'test')
  assert.equal(v2, 1)
})

test('computeColdIntervalMinutes — dégâts (Glacial+) toujours horaire à la base', () => {
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 0, wet: false }, 'damage'), 60)
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 1, wet: false }, 'damage'), 30)
  assert.equal(computeColdIntervalMinutes({ tier: 'glacial', extremeSteps: 0, wet: true }, 'damage'), 30)
})
