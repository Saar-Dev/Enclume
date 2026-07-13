import test from 'node:test'
import assert from 'node:assert/strict'

import { compileSurfaceWorld } from './worldCompiler.js'
import { makeRoomBoundaryArc, roomBoundaryPaths, roomBoundaryWallRuns } from './roomGeometry.js'

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

test('un arrondi de salle reste un arc canonique pour collision et ligne de vue', () => {
  const roundedRoom = {
    ...room('rounded', 0, 1, 0, 1),
    cells: ['0:0', '1:0', '0:1', '1:1'],
  }
  const selected = roomBoundaryWallRuns(roundedRoom).filter(wall => ['west', 'north'].includes(wall.side))
  roundedRoom.boundaryArcs = [makeRoomBoundaryArc(roundedRoom, selected.flatMap(wall => wall.edgeKeys), 90).arc]
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-rounded-room',
    surfaceData: emptySurface({ rooms: { rounded: roundedRoom } }),
  })
  const curved = snapshot.spatial.barriers.filter(item => item.kind === 'wall' && item.axis === 'arc')

  assert.equal(curved.length, 1)
  assert.ok(curved.every(item => item.blocks.movement && item.blocks.sight && item.blocks.water))
  assert.ok(curved.every(item => item.geometry?.type === 'wall-arc'))
  assert.ok(curved.every(item => snapshot.spatial.colliders.some(collider => (
    collider.sourceId === item.sourceId && collider.geometry?.type === 'wall-arc'
  ))))
  assert.ok(curved.every(item => snapshot.spatial.occluders.some(occluder => (
    occluder.sourceId === item.sourceId && occluder.geometry?.type === 'wall-arc'
  ))))
})

test('une porte courbe découpe l arc et compile son portail selon la normale locale', () => {
  const roundedRoom = {
    ...room('rounded', 0, 1, 0, 1),
    cells: ['0:0', '1:0', '0:1', '1:1'],
  }
  const selected = roomBoundaryWallRuns(roundedRoom).filter(wall => ['west', 'north'].includes(wall.side))
  const arc = makeRoomBoundaryArc(roundedRoom, selected.flatMap(wall => wall.edgeKeys), 90).arc
  roundedRoom.boundaryArcs = [{ ...arc, ownerRoomId: 'rounded' }]
  const path = roomBoundaryPaths({ id: 'rounded', ...roundedRoom }, { rounded: roundedRoom })
    .find(item => item.axis === 'arc')
  const curveOffset = (path.curveOffset0 + path.curveOffset1) / 2
  const angle = path.startAngle + path.sweep / 2
  const sweepSign = Math.sign(path.sweep)
  const tangentX = -Math.sin(angle) * sweepSign
  const tangentZ = Math.cos(angle) * sweepSign
  const normalX = -tangentZ
  const normalZ = tangentX
  const anchorX = path.centerX + Math.cos(angle) * path.radius
  const anchorZ = path.centerZ + Math.sin(angle) * path.radius
  const width = 0.8
  const surface = emptySurface({
    rooms: { rounded: roundedRoom },
    connectors: {
      curvedDoor: {
        id: 'curvedDoor',
        type: 'door',
        axis: 'segment',
        level: 0,
        y: 0,
        x0: (anchorX - tangentX * width / 2) * 4,
        z0: (anchorZ - tangentZ * width / 2) * 4,
        x1: (anchorX + tangentX * width / 2) * 4,
        z1: (anchorZ + tangentZ * width / 2) * 4,
        anchorX,
        anchorZ,
        tangentX,
        tangentZ,
        normalX,
        normalZ,
        rotationY: -Math.atan2(tangentZ, tangentX),
        curveId: path.curveId,
        curveOffset,
        width,
        depth: 0.2,
        height: 2,
        thickness: 1,
        roomId: 'rounded',
        roomIds: ['rounded'],
        state: 'open',
      },
    },
  })
  const snapshot = compileSurfaceWorld({ battlemapId: 'map-curved-door', surfaceData: surface })
  const arcWalls = snapshot.spatial.barriers.filter(item => item.kind === 'wall' && item.axis === 'arc')
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'door')

  assert.equal(arcWalls.length, 3)
  assert.ok(arcWalls.every(item => item.geometry?.type === 'wall-arc'))
  assert.ok(traversal.enabled)
  const traversalDx = traversal.to.x - traversal.from.x
  const traversalDz = traversal.to.z - traversal.from.z
  assert.ok(Math.abs(traversalDx * tangentX + traversalDz * tangentZ) < 1e-6)
  assert.ok(Math.hypot(traversalDx, traversalDz) > 0.2)
})

test('un mur exterieur supprime ne compile plus de collision ni de ligne de vue', () => {
  const openedRoom = { ...room('opened', 0, 0), cells: ['0:0'] }
  openedRoom.openWallEdgeKeys = roomBoundaryWallRuns(openedRoom)
    .find(wall => wall.side === 'north')
    .edgeKeys
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-opened-room',
    surfaceData: emptySurface({ version: 8, rooms: { opened: openedRoom } }),
  })

  const walls = snapshot.spatial.barriers.filter(item => item.kind === 'wall')
  assert.equal(walls.length, 3)
  assert.equal(snapshot.spatial.colliders.filter(item => item.kind === 'wall').length, 3)
  assert.equal(snapshot.spatial.occluders.filter(item => item.kind === 'wall').length, 3)
})

test('deux salles decoupees partagent un unique mur courbe physique', () => {
  const rounded = {
    ...room('rounded', 0, 1, 0, 1),
    cells: ['0:0', '1:0', '0:1', '1:1'],
  }
  const selected = roomBoundaryWallRuns(rounded).filter(wall => ['west', 'north'].includes(wall.side))
  rounded.boundaryArcs = [makeRoomBoundaryArc(rounded, selected.flatMap(wall => wall.edgeKeys), 90).arc]
  const adjacent = {
    ...room('adjacent', 0, 1, 0, 1),
    cells: ['0:0', '1:0', '0:1', '1:1'],
    geometryClipRoomIds: ['rounded'],
  }
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-clipped-room',
    surfaceData: emptySurface({ version: 8, rooms: { rounded, adjacent } }),
  })

  const sharedCurves = snapshot.spatial.barriers.filter(item => (
    item.kind === 'wall' && item.axis === 'arc' && item.sourceIds?.length === 2
  ))
  assert.equal(sharedCurves.length, 1)
  assert.ok(sharedCurves.every(item => item.blocks.movement && item.blocks.sight))
})

test('une salle imbriquee compile deux empreintes exclusives et leur contour commun', () => {
  const outerCells = []
  for (let z = 0; z < 4; z += 1) {
    for (let x = 0; x < 4; x += 1) {
      if (x >= 1 && x <= 2 && z >= 1 && z <= 2) continue
      outerCells.push(`${x}:${z}`)
    }
  }
  const outer = { ...room('outer', 0, 3, 0, 3), shape: 'footprint', cells: outerCells }
  const inner = { ...room('inner', 1, 2, 1, 2), shape: 'footprint', cells: ['1:1', '2:1', '1:2', '2:2'] }
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-nested-room',
    surfaceData: emptySurface({ rooms: { outer, inner } }),
  })

  assert.equal(snapshot.spatial.supports.filter(item => item.kind === 'floor').length, 16)
  assert.equal(snapshot.spatial.barriers.filter(item => item.kind === 'wall').length, 24)
  assert.equal(snapshot.spatial.barriers.filter(item => item.kind === 'wall' && item.sourceIds?.length === 2).length, 8)
  assert.deepEqual(snapshot.spatial.compartments.map(item => item.footprint.length).sort((a, b) => a - b), [4, 12])
  const [first, second] = snapshot.spatial.compartments.map(item => new Set(item.footprint))
  assert.equal([...first].some(cell => second.has(cell)), false)
})

test('un segment de mur courbe compile les mêmes canaux physiques que son rendu', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-curved-wall',
    surfaceData: emptySurface({
      walls: {
        curveA: {
          worldId: '11111111-1111-4111-8111-111111111111',
          axis: 'segment',
          x0: 0,
          z0: 0,
          x1: 4,
          z1: 4,
          y: 0,
          height: 2.5,
          thickness: 1,
          barrierType: 'solid',
          blocksMovement: true,
          blocksSight: true,
          blocksWater: true,
        },
      },
    }),
  })

  const barrier = snapshot.spatial.barriers.find(item => item.sourceIds?.includes('11111111-1111-4111-8111-111111111111'))
  assert.equal(barrier.axis, 'segment')
  assert.deepEqual(barrier.bounds, {
    min: { x: -0.125, y: 0, z: -0.125 },
    max: { x: 1.125, y: 2.5, z: 1.125 },
  })
  assert.deepEqual(barrier.geometry, {
    type: 'wall-segment',
    from: { x: 0, z: 0 },
    to: { x: 1, z: 1 },
    minY: 0,
    maxY: 2.5,
    thickness: 0.25,
  })
  assert.equal(snapshot.spatial.colliders.some(item => item.sourceId === barrier.sourceId), true)
  assert.equal(snapshot.spatial.occluders.some(item => item.sourceId === barrier.sourceId), true)
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
  assert.deepEqual(traversal.from, { x: 0, y: 0.125, z: 0.5 })
  assert.deepEqual(traversal.to, { x: 2, y: 2.625, z: 0.5 })
  assert.equal(traversal.allowPartial, true)
  assert.equal(traversal.movementMultiplier, 1.5)
})

test('une échelle compile une traversée climb fractionnable avec des ancrages fins', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-ladder',
    surfaceData: emptySurface({
      connectors: {
        ladderA: {
          id: 'ladderA', type: 'ladder', x: 2, z: 3,
          fromY: 0.125, toY: 5.125, anchorSpacing: 0.5,
          movementMultiplier: 2,
        },
      },
    }),
  })
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'ladder')
  assert.deepEqual(traversal.from, { x: 2.5, y: 0.125, z: 3.5 })
  assert.deepEqual(traversal.to, { x: 2.5, y: 5.125, z: 3.5 })
  assert.equal(traversal.mode, 'climb')
  assert.equal(traversal.allowPartial, true)
  assert.equal(traversal.anchorSpacing, 0.5)
  assert.equal(traversal.movementMultiplier, 2)
})

test('une passerelle détruite ne compile plus son support', () => {
  const surfaceData = emptySurface({
    floors: {
      '0:0:2.5': {
        id: 'bridgeA', kind: 'bridge', runtimeSupport: true,
        x: 0, z: 0, y: 2.5, thickness: 0.25, walkable: true,
      },
    },
  })
  const active = compileSurfaceWorld({ battlemapId: 'map-bridge', surfaceData })
  const bridge = active.spatial.supports.find(item => item.kind === 'bridge')
  assert.ok(bridge)
  const destroyed = compileSurfaceWorld({
    battlemapId: 'map-bridge',
    surfaceData,
    runtimeState: { featureStates: { [bridge.sourceId]: { state: 'destroyed' } } },
  })
  assert.equal(destroyed.spatial.supports.some(item => item.sourceId === bridge.sourceId), false)
  assert.equal(destroyed.spatial.colliders.some(item => item.sourceId === bridge.sourceId), false)
})

test('un ascenseur compile une cabine mobile et jamais une téléportation verticale', () => {
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
  assert.equal(snapshot.spatial.traversals.some(item => item.mode === 'elevator'), false)
  const boarding = snapshot.spatial.traversals.find(item => item.kind === 'elevator-boarding')
  assert.ok(boarding)
  assert.equal(boarding.allowPartial, false)
  const cabin = snapshot.spatial.supports.find(item => item.kind === 'elevator-cabin')
  assert.ok(cabin)
  assert.equal(cabin.mobile, true)
})

test('une cabine en mouvement ferme tous les paliers et déplace son support', () => {
  const surfaceData = emptySurface({
    connectors: {
      liftA: { id: 'liftA', type: 'elevator', x: 0, z: 0, fromLevel: 0, toLevel: 2 },
    },
  })
  const initial = compileSurfaceWorld({ battlemapId: 'map-moving-lift', surfaceData })
  const sourceId = initial.spatial.supports.find(item => item.kind === 'elevator-cabin').sourceId
  const moving = compileSurfaceWorld({
    battlemapId: 'map-moving-lift',
    surfaceData,
    runtimeState: {
      featureStates: {
        [sourceId]: {
          phase: 'moving', currentStopId: 'level:0', targetStopId: 'level:2',
          positionY: 2.625, doorState: 'closed', queue: [],
          transitionStartedAt: 0, transitionEndsAt: 10000,
          movementFromY: 0.125, movementToY: 5.125,
        },
      },
    },
  })
  assert.equal(moving.spatial.traversals.some(item => item.kind === 'elevator-boarding'), false)
  assert.equal(moving.spatial.supports.find(item => item.kind === 'elevator-cabin').y, 2.625)
  assert.equal(moving.spatial.barriers.filter(item => item.kind === 'elevator-landing-door').length, 3)
})

test('la compilation est déterministe pour une même entrée', () => {
  const args = {
    battlemapId: 'map-deterministic',
    worldRevision: 9,
    surfaceData: emptySurface({ rooms: { roomA: room('roomA', 0, 1) } }),
  }
  assert.deepEqual(compileSurfaceWorld(args), compileSurfaceWorld(args))
})
