import test from 'node:test'
import assert from 'node:assert/strict'

import {
  collectBattlemapTextureIds,
  hasRevisionConflict,
  parseExpectedRevision,
} from './battlemapWorldPersistence.js'

test('les usages texture réunissent voxels et surfaces sans s’effacer mutuellement', () => {
  const ids = collectBattlemapTextureIds(
    { '0:0:0': { tex: 4 }, '1:0:0': { tex: 4 } },
    {
      rooms: { roomA: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, floorTopTex: 7 } },
      floors: {}, walls: {}, ceilings: {}, stairs: {}, connectors: {},
    },
  )
  assert.deepEqual(new Set(ids), new Set([4, 7]))
})

test('les révisions documentaires sont validées et comparées indépendamment', () => {
  assert.equal(parseExpectedRevision('3', 'surface_revision'), 3)
  assert.equal(parseExpectedRevision(null, 'surface_revision'), null)
  assert.equal(hasRevisionConflict(3, 3), false)
  assert.equal(hasRevisionConflict(4, 3), true)
  assert.throws(() => parseExpectedRevision(-1, 'surface_revision'))
})
