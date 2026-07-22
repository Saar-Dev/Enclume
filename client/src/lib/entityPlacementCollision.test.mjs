import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildEntityPlacementVolume,
  buildWallPlacementVolume,
  placementVolumesOverlap,
  validateEntityPlacement,
} from './entityPlacementCollision.js'

const crate = {
  id: 'crate',
  geometry: { width: 2, height: 1, depth: 1, origin: 'floor-center', placementMode: 'free' },
  states: [],
}

test('un volume floor-center suit les quarts de tour et l’échelle de l’instance', () => {
  const volume = buildEntityPlacementVolume({
    position: { x: 4, y: 2.5, z: 7 },
    rotation: 1,
    blueprint: crate,
    entityState: { transform: { scale: 1.5 } },
  })
  assert.deepEqual(
    {
      centerX: volume.centerX,
      centerZ: volume.centerZ,
      halfWidth: volume.halfWidth,
      halfDepth: volume.halfDepth,
      minY: volume.minY,
      maxY: volume.maxY,
    },
    { centerX: 4, centerZ: 7, halfWidth: 0.75, halfDepth: 1.5, minY: 2.5, maxY: 4 },
  )
})

test('un blueprint legacy tourne autour du même centre que son rendu', () => {
  const legacy = { ...crate, geometry: { width: 2, height: 1, depth: 1, placementMode: 'free' } }
  const volume = buildEntityPlacementVolume({
    position: { x: 3, y: 0, z: 4 },
    rotation: 1,
    blueprint: legacy,
  })
  assert.deepEqual(
    {
      centerX: volume.centerX,
      centerZ: volume.centerZ,
      halfWidth: volume.halfWidth,
      halfDepth: volume.halfDepth,
    },
    { centerX: 4, centerZ: 4.5, halfWidth: 0.5, halfDepth: 1 },
  )
})

test('deux volumes qui se touchent exactement restent posables', () => {
  const left = buildEntityPlacementVolume({ position: { x: 0, y: 0, z: 0 }, blueprint: crate })
  const right = buildEntityPlacementVolume({ position: { x: 2, y: 0, z: 0 }, blueprint: crate })
  assert.equal(placementVolumesOverlap(left, right), false)
})

test('la collision murale tient compte de la rotation des segments courbes tessellés', () => {
  const wall = buildWallPlacementVolume({
    position: [0, 1.25, 0],
    args: [4, 2.5, 0.25],
    rotationY: Math.PI / 4,
  }, 'wall:arc')
  const blocked = validateEntityPlacement({
    position: { x: 0.5, y: 0, z: -0.5 },
    blueprint: crate,
    wallVolumes: [wall],
  })
  const clear = validateEntityPlacement({
    position: { x: 5, y: 0, z: 5 },
    blueprint: crate,
    wallVolumes: [wall],
  })
  assert.equal(blocked.reason, 'wall')
  assert.equal(clear.valid, true)
})

test('un autre objet bloque la pose, mais l’entité déplacée est exclue de son propre test', () => {
  const entities = [{
    id: 'existing',
    blueprint_id: 'crate',
    pos_x: 1,
    pos_y: 1,
    pos_z: 0,
    r: 0,
    state: {},
    current_state_id: 0,
  }]
  const blocked = validateEntityPlacement({
    position: { x: 1.5, y: 0, z: 1 },
    blueprint: crate,
    entities,
    blueprints: { crate },
  })
  const self = validateEntityPlacement({
    position: { x: 1.5, y: 0, z: 1 },
    blueprint: crate,
    entityId: 'existing',
    entities,
    blueprints: { crate },
  })
  assert.equal(blocked.reason, 'entity')
  assert.equal(self.valid, true)
})

test('un objet mural ignore son mur support sans pouvoir chevaucher un autre objet', () => {
  const panel = {
    ...crate,
    id: 'panel',
    geometry: { ...crate.geometry, placementMode: 'wall', origin: 'wall-back-center' },
  }
  const wall = buildWallPlacementVolume({ position: [0, 1.25, 0], args: [5, 2.5, 0.25] }, 'wall')
  const result = validateEntityPlacement({
    position: { x: 0, y: 0.5, z: 0 },
    blueprint: panel,
    wallVolumes: [wall],
  })
  assert.equal(result.valid, true)
})

test('un volume structurel bloque les objets libres et les objets muraux', () => {
  const door = buildWallPlacementVolume({
    position: [0, 1, 0],
    args: [1, 2, 0.3],
  }, 'door:1', 'door')
  const panel = {
    ...crate,
    id: 'panel',
    geometry: { ...crate.geometry, placementMode: 'wall', origin: 'wall-back-center' },
  }
  const freeResult = validateEntityPlacement({
    position: { x: 0, y: 0, z: 0 },
    blueprint: crate,
    obstacleVolumes: [door],
  })
  const wallResult = validateEntityPlacement({
    position: { x: 0, y: 0, z: 0 },
    blueprint: panel,
    obstacleVolumes: [door],
  })
  assert.equal(freeResult.reason, 'structure')
  assert.equal(wallResult.reason, 'structure')
})
