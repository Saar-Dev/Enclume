import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACTIVE_MALUS_SOURCES, calcActiveMalus } from './activeMalusRegistry.js'

const baseCtx = {
  wounds: [],
  fatiguePoints: 0,
  totalWeight: 0,
  forNA: 10,
  settings: { encumbrance_enabled: true, encumbrance_multiplier: 3, fatigue_enabled: true },
}

test('ACTIVE_MALUS_SOURCES — 3 sources déclarées', () => {
  assert.deepEqual(ACTIVE_MALUS_SOURCES.map(s => s.key), ['wound', 'encumbrance', 'fatigue'])
})

test('calcActiveMalus — aucune source active = 0', () => {
  assert.equal(calcActiveMalus(baseCtx), 0)
})

test('calcActiveMalus — blessure seule', () => {
  const ctx = { ...baseCtx, wounds: [{ severity: 'grave' }] }
  const malus = calcActiveMalus(ctx)
  assert.ok(malus < 0)
})

test('calcActiveMalus — encombrement gaté par settings.encumbrance_enabled', () => {
  const ctxOn  = { ...baseCtx, totalWeight: 100, forNA: 10 }
  const ctxOff = { ...ctxOn, settings: { ...ctxOn.settings, encumbrance_enabled: false } }
  assert.ok(calcActiveMalus(ctxOn) < 0)
  assert.equal(calcActiveMalus(ctxOff), 0)
})

test('calcActiveMalus — fatigue gatée par settings.fatigue_enabled', () => {
  const ctxOn  = { ...baseCtx, fatiguePoints: 6 } // palier 2, Fatigué (-5)
  const ctxOff = { ...ctxOn, settings: { ...ctxOn.settings, fatigue_enabled: false } }
  assert.equal(calcActiveMalus(ctxOn), -5)
  assert.equal(calcActiveMalus(ctxOff), 0)
})

test('calcActiveMalus — cumul des trois sources', () => {
  const ctx = {
    wounds: [{ severity: 'legere' }],
    fatiguePoints: 3, // palier 1, Légèrement fatigué (-3)
    totalWeight: 200,
    forNA: 10,
    settings: { encumbrance_enabled: true, encumbrance_multiplier: 3, fatigue_enabled: true },
  }
  const wound = ACTIVE_MALUS_SOURCES[0].compute(ctx)
  const encumbrance = ACTIVE_MALUS_SOURCES[1].compute(ctx)
  const fatigue = ACTIVE_MALUS_SOURCES[2].compute(ctx)
  assert.equal(calcActiveMalus(ctx), wound + encumbrance + fatigue)
})

test('calcActiveMalus — exclude retire uniquement la source visée (auto-exemption Test de Fatigue)', () => {
  const ctx = { ...baseCtx, wounds: [{ severity: 'grave' }], fatiguePoints: 6 }
  const withFatigue = calcActiveMalus(ctx)
  const withoutFatigue = calcActiveMalus(ctx, { exclude: ['fatigue'] })
  assert.equal(withoutFatigue, withFatigue - getFatigueContribution(ctx))
})

function getFatigueContribution(ctx) {
  return ACTIVE_MALUS_SOURCES.find(s => s.key === 'fatigue').compute(ctx)
}
