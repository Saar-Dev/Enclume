import test from 'node:test'
import assert from 'node:assert/strict'

import { tokenDistanceM } from './worldSpatialQueryService.js'

const metrics = {
  metersPerCell: 1.5,
  worldUnitsPerCell: 1,
  storyHeightWorld: 2.5,
  metersPerWorldUnit: 1.5,
  storyHeightM: 3.75,
}

test('mesure la distance 3D en metres dans le repere canonique', () => {
  const source = { position_space: 'world-feet', pos_x: 0, pos_y: 0, pos_z: 0 }
  const target = { position_space: 'world-feet', pos_x: 0, pos_y: 4, pos_z: 3 }
  assert.equal(tokenDistanceM(source, target, metrics), 7.5)
})

test('refuse les positions historiques sans unite canonique', () => {
  assert.throws(() => tokenDistanceM(
    { position_space: 'legacy', pos_x: 0, pos_y: 0, pos_z: 0 },
    { position_space: 'world-feet', pos_x: 0, pos_y: 0, pos_z: 0 },
    metrics,
  ), /incompatible/)
})
