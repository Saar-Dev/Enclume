import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BATTLEMAP_DOCUMENT_REVISION_COLUMNS,
  collectBattlemapTextureIds,
  hasRevisionConflict,
  parseExpectedRevision,
} from './battlemapWorldPersistence.js'

test('les écritures documentaires demandent explicitement toutes les révisions à PostgreSQL', () => {
  assert.deepEqual(BATTLEMAP_DOCUMENT_REVISION_COLUMNS, [
    'id',
    'world_revision',
    'surface_revision',
  ])
})

test('les usages texture collectent les ids référencés par surface_data', () => {
  const ids = collectBattlemapTextureIds({
    rooms: { roomA: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, floorTex: 7 } },
    floors: {}, walls: {}, ceilings: {}, stairs: {}, connectors: {},
  })
  assert.deepEqual(new Set(ids), new Set([7]))
})

test('les révisions documentaires sont validées et comparées indépendamment', () => {
  assert.equal(parseExpectedRevision('3', 'surface_revision'), 3)
  assert.equal(parseExpectedRevision(null, 'surface_revision'), null)
  assert.equal(hasRevisionConflict(3, 3), false)
  assert.equal(hasRevisionConflict(4, 3), true)
  assert.throws(() => parseExpectedRevision(-1, 'surface_revision'))
})
