import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveCareerRandomEffects } from './careerAdvantages.js'

const BENEFIT_ROWS = [
  { roll: 1, effects: [{ type: 'attribute', target: 'ADA', value: 1 }] },
  { roll: 2, effects: [{ type: 'skill_points', value: 2 }, { type: 'celebrity', value: 2 }, { type: 'category', target: 'Matériel', value: 1 }] },
  { roll: 3, effects: [{ type: 'income_percent', value: 10 }] },
  { roll: 5, effects: [{ type: 'income_multiplier', value: 2 }] },
  { roll: 8, effects: [] },
  { roll: 10, effects: [] },
]

test('additionne les effets de plusieurs tirages resolus', () => {
  const picks = [{ blockIndex: 0, roll: 1 }, { blockIndex: 1, roll: 2 }]
  const totals = resolveCareerRandomEffects(picks, BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, { ADA: 1 })
  assert.equal(totals.celebrity, 2)
  assert.equal(totals.skillPoints, 2)
  assert.deepEqual(totals.categories, { 'Matériel': 1 })
})

test('useAsPoints=true exclut l\'effet de la ligne (jamais points ET effet)', () => {
  const picks = [{ blockIndex: 0, roll: 10, useAsPoints: true }, { blockIndex: 1, roll: 1, useAsPoints: false }]
  const totals = resolveCareerRandomEffects(picks, BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, { ADA: 1 })
})

test('income_percent et income_multiplier se composent, base neutre 1/0 sans tirage', () => {
  const noPicks = resolveCareerRandomEffects([], BENEFIT_ROWS)
  assert.equal(noPicks.incomeMultiplier, 1)
  assert.equal(noPicks.incomePercent, 0)

  const withBoth = resolveCareerRandomEffects(
    [{ blockIndex: 0, roll: 3 }, { blockIndex: 1, roll: 5 }],
    BENEFIT_ROWS
  )
  assert.equal(withBoth.incomePercent, 10)
  assert.equal(withBoth.incomeMultiplier, 2)
})

test('meme attribut cumule sur plusieurs tirages (deux tranches, meme roll)', () => {
  const picks = [{ blockIndex: 0, roll: 1 }, { blockIndex: 1, roll: 1 }]
  const totals = resolveCareerRandomEffects(picks, BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, { ADA: 2 })
})

test('picks vides ou undefined -> totaux neutres', () => {
  assert.deepEqual(resolveCareerRandomEffects(undefined, BENEFIT_ROWS).attributes, {})
  assert.deepEqual(resolveCareerRandomEffects([], BENEFIT_ROWS).categories, {})
})

test('roll sans ligne correspondante (defensif) -> ignore silencieusement', () => {
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 999 }], BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, {})
  assert.equal(totals.celebrity, 0)
})
