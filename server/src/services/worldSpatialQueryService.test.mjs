import test from 'node:test'
import assert from 'node:assert/strict'

import { loadBattlemapDoorConnector, tokenDistanceM } from './worldSpatialQueryService.js'
import { prepareSurfaceData } from '../../../shared/world/surfaceDocument.js'

function surfaceFixture() {
  return {
    version: 4,
    fine: 4,
    storyHeight: 2.5,
    rooms: {
      'room:legacy': { id: 'room:legacy', minX: 0, maxX: 0, minZ: 0, maxZ: 0, floorTex: 10, wallInteriorTex: 11 },
    },
    floors: {},
    walls: {},
    ceilings: {},
    stairs: {},
    connectors: {
      'door:test': { type: 'door', axis: 'x', x0: 0, x1: 2, z0: 0, z1: 0, y: 0 },
      'lift:test': { type: 'elevator', x: 5, z: 5, fromLevel: 0, toLevel: 1 },
    },
  }
}

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

test('loadBattlemapDoorConnector retrouve une porte par worldId, jamais par clé legacy', () => {
  const battlemap = { id: 'bm-test', surface_data: surfaceFixture() }
  const prepared = prepareSurfaceData(surfaceFixture(), { battlemapId: 'bm-test' }).surfaceData
  const doorWorldId = prepared.connectors['door:test'].worldId
  const liftWorldId = prepared.connectors['lift:test'].worldId

  const found = loadBattlemapDoorConnector(battlemap, doorWorldId)
  assert.equal(found?.type, 'door')
  assert.equal(found?.worldId, doorWorldId)

  // Un ascenseur (même document, même mécanisme de worldId) n'est jamais renvoyé comme porte.
  assert.equal(loadBattlemapDoorConnector(battlemap, liftWorldId), null)

  // La clé legacy elle-même ("door:test") n'est pas un worldId valide — lookup par clé refusé,
  // c'est exactement le bug qu'un lookup par clé d'objet aurait laissé passer silencieusement.
  assert.equal(loadBattlemapDoorConnector(battlemap, 'door:test'), null)

  // Connecteur inexistant.
  assert.equal(loadBattlemapDoorConnector(battlemap, 'not-a-real-id'), null)
})
