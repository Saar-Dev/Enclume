import test from 'node:test'
import assert from 'node:assert/strict'

import { compileSurfaceWorld } from './worldCompiler.js'

function emptySurface(patch = {}) {
  return {
    version: 4,
    fine: 4,
    storyHeight: 2.5,
    rooms: {},
    floors: {},
    walls: {},
    ceilings: {},
    stairs: {},
    connectors: {},
    ...patch,
  }
}

function room(id, minX, maxX, minZ = 0, maxZ = 0) {
  return {
    id,
    minX,
    maxX,
    minZ,
    maxZ,
    level: 0,
    y: 0,
    heightLevels: 1,
    floorThickness: 0.25,
    ceilingThickness: 0.25,
    wallThickness: 1,
    floorEnabled: true,
    ceilingEnabled: true,
    wallEnabled: true,
    barrierType: 'solid',
    blocksMovement: true,
    blocksSight: true,
    blocksWater: true,
  }
}

test('une salle simple compile un support, quatre murs et un compartiment', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-room',
    worldRevision: 2,
    surfaceData: emptySurface({ rooms: { roomA: room('roomA', 0, 0) } }),
  })

  assert.equal(snapshot.worldRevision, 2)
  assert.equal(snapshot.spatial.supports.filter(item => item.kind === 'floor').length, 1)
  assert.equal(snapshot.spatial.barriers.filter(item => item.kind === 'wall').length, 4)
  assert.equal(snapshot.spatial.compartments.length, 1)
})

test('deux salles adjacentes partagent un seul mur physique', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-adjacent',
    surfaceData: emptySurface({
      rooms: {
        roomA: room('roomA', 0, 0),
        roomB: room('roomB', 1, 1),
      },
    }),
  })
  const walls = snapshot.spatial.barriers.filter(item => item.kind === 'wall')
  assert.equal(walls.length, 7)
  assert.equal(walls.filter(item => item.sourceIds?.length === 2).length, 1)
})

test('une porte ouverte découpe le mur et crée un portail non bloquant', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-door',
    surfaceData: emptySurface({
      rooms: { roomA: room('roomA', 0, 0) },
      connectors: {
        doorA: {
          id: 'doorA',
          type: 'door',
          axis: 'x',
          x0: 1,
          x1: 3,
          z0: 0,
          z1: 0,
          alongCenter: 2,
          y: 0,
          width: 0.5,
          depth: 0.25,
          height: 2,
          state: 'open',
          roomIds: ['roomA'],
        },
      },
    }),
  })

  const doorBarrier = snapshot.spatial.barriers.find(item => item.kind === 'door')
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'door')
  const northWallPieces = snapshot.spatial.barriers.filter(item => (
    item.kind === 'wall' && item.axis === 'x' && Math.abs(item.bounds.min.z + 0.125) < 1e-9
  ))

  assert.ok(doorBarrier)
  assert.deepEqual(doorBarrier.blocks, { movement: false, sight: false, water: false, gas: false })
  assert.equal(traversal.enabled, true)
  assert.equal(northWallPieces.length, 3)
  assert.equal(snapshot.spatial.colliders.some(item => item.sourceId === doorBarrier.sourceId), false)
})

test('mur plein, verre et grille compilent des canaux physiques indépendants', () => {
  const cases = [
    ['solid', { movement: true, sight: true, water: true, gas: true }, true],
    ['glass', { movement: true, sight: false, water: true, gas: true }, false],
    ['grate', { movement: true, sight: false, water: false, gas: false }, false],
  ]
  for (const [barrierType, expectedBlocks, hasOccluder] of cases) {
    const descriptor = room(`room-${barrierType}`, 0, 0)
    descriptor.barrierType = barrierType
    delete descriptor.blocksMovement
    delete descriptor.blocksSight
    delete descriptor.blocksWater
    const snapshot = compileSurfaceWorld({
      battlemapId: `map-${barrierType}`,
      surfaceData: emptySurface({ rooms: { roomA: descriptor } }),
    })
    const wall = snapshot.spatial.barriers.find(item => item.kind === 'wall')
    assert.deepEqual(wall.blocks, expectedBlocks)
    assert.equal(
      snapshot.spatial.occluders.some(item => item.sourceId === wall.sourceId),
      hasOccluder,
    )
    assert.equal(snapshot.spatial.colliders.some(item => item.sourceId === wall.sourceId), true)
  }
})

test('la découpe physique d’une porte suit le cadre et non le seul panneau mobile', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-door-frame',
    surfaceData: emptySurface({
      rooms: { roomA: room('roomA', 0, 0) },
      connectors: {
        doorA: {
          id: 'doorA', type: 'door', axis: 'x',
          x0: 0, x1: 4, z0: 0, z1: 0, alongCenter: 2, y: 0,
          width: 1, depth: 0.25, height: 2, state: 'closed',
          modelGeometry: { openingWidth: 0.5, wallCutWidth: 1 },
        },
      },
    }),
  })
  const northWallPieces = snapshot.spatial.barriers.filter(item => (
    item.kind === 'wall' && item.axis === 'x' && Math.abs(item.bounds.min.z + 0.125) < 1e-9
  ))
  const doorBarrier = snapshot.spatial.barriers.find(item => item.kind === 'door')

  assert.equal(northWallPieces.length, 1)
  assert.equal(doorBarrier.bounds.max.x - doorBarrier.bounds.min.x, 0.5)
})

test('un escalier compile une traversée fractionnable entre deux hauteurs', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-stairs',
    surfaceData: emptySurface({
      stairs: {
        stairA: {
          id: 'stairA',
          axis: 'x',
          dir: 1,
          minX: 0,
          maxX: 1,
          minZ: 0,
          maxZ: 0,
          y: 0,
          topY: 2.5,
          walkable: true,
          movementMultiplier: 1.5,
        },
      },
    }),
  })
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'stairs')
  assert.deepEqual(traversal.from, { x: 0, y: 0, z: 0.5 })
  assert.deepEqual(traversal.to, { x: 2, y: 2.5, z: 0.5 })
  assert.equal(traversal.allowPartial, true)
  assert.equal(traversal.movementMultiplier, 1.5)
})

test('un ascenseur n’est pas transformé en téléportation avant son contrôleur runtime', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-elevator',
    surfaceData: emptySurface({
      connectors: {
        liftA: {
          id: 'liftA',
          type: 'elevator',
          x: 0,
          z: 0,
          fromLevel: 0,
          toLevel: 3,
          width: 1,
          depth: 1,
        },
      },
    }),
  })
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'elevator')
  assert.equal(traversal.enabled, false)
  assert.equal(traversal.allowPartial, false)
  assert.equal(traversal.requiresRuntimeController, true)
})

test('la compilation est déterministe pour une même entrée', () => {
  const args = {
    battlemapId: 'map-deterministic',
    worldRevision: 9,
    surfaceData: emptySurface({ rooms: { roomA: room('roomA', 0, 1) } }),
  }
  assert.deepEqual(compileSurfaceWorld(args), compileSurfaceWorld(args))
})
