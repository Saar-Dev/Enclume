import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ladderVisualRange,
  ladderVisualTopY,
} from './verticalAccessGeometry.js'

const ladder = {
  type: 'ladder',
  y: 0.125,
  fromY: 0.125,
  toY: 2.625,
  topY: 2.625,
}

test('une échelle sans trappe dépasse le palier supérieur pour rester saisissable', () => {
  assert.equal(ladderVisualTopY(ladder), 3.375)
  assert.deepEqual(ladderVisualRange(ladder), {
    bottomY: 0.125,
    topY: 3.375,
    height: 3.25,
  })
  assert.deepEqual(ladderVisualRange(ladder, { displayLevel: 1 }), {
    bottomY: 2.5,
    topY: 3.375,
    height: 0.875,
  })
})

test('une échelle avec trappe s arrête exactement sous le modèle', () => {
  const linkedHatch = { type: 'hatch', y: 2.5, height: 0.38 }
  assert.equal(ladderVisualTopY(ladder, { linkedHatch }), 2.5)
  assert.deepEqual(ladderVisualRange(ladder, { linkedHatch, displayLevel: 0 }), {
    bottomY: 0.125,
    topY: 2.5,
    height: 2.375,
  })
  assert.equal(ladderVisualRange(ladder, { linkedHatch, displayLevel: 1 }), null)
})
