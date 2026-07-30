import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BURNING_PRESETS, DECOMPRESSION_PRESETS } from './environmentalHazardPresets.js'

test('BURNING_PRESETS — 4 paliers RAW (FATIGUE&DOMMAGES.md:108-119)', () => {
  assert.deepEqual(BURNING_PRESETS, [
    { key: 'small',   formula: '1d6',  locations: 1 },
    { key: 'medium',  formula: '1d10', locations: 1 },
    { key: 'large',   formula: '2d10', locations: '1d3' },
    { key: 'inferno', formula: '3d10', locations: 1 },
  ])
})

test('DECOMPRESSION_PRESETS — RAW 1D10 normal / 2D10 paliers multiples (FATIGUE&DOMMAGES.md:40-48)', () => {
  assert.deepEqual(DECOMPRESSION_PRESETS, [
    { key: 'normal', formula: '1d10' },
    { key: 'severe', formula: '2d10' },
  ])
})
