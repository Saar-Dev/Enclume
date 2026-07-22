import test from 'node:test'
import assert from 'node:assert/strict'

import { compileSurfaceWorld } from './worldCompiler.js'
import { stairGeometry } from './stairGeometry.js'
import {
  buildMergedRoomVerticalProfile,
  makeRoomBoundaryArc,
  multiPolygonArea,
  multiPolygonContainsPoint,
  roomBoundaryPaths,
  roomBoundaryWallRuns,
} from './roomGeometry.js'

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

test('le compilateur distingue le profil extérieur du profil de face mitoyenne', () => {
  const exterior = room('exterior', 0, 0)
  const exteriorEdge = roomBoundaryWallRuns(exterior).find(run => run.side === 'west')
  exterior.wallElevationProfiles = [{
    id: 'outer-profile',
    edgeKeys: exteriorEdge.edgeKeys,
    profile: { type: 'curved', depth: 0.5, direction: 1 },
  }]
  const exteriorSnapshot = compileSurfaceWorld({
    battlemapId: 'map-profile-exterior',
    surfaceData: emptySurface({ version: 10, rooms: { exterior } }),
  })
  const translated = exteriorSnapshot.spatial.barriers.find(barrier => barrier.geometry?.elevationProfileMode === 'translated')
  assert.equal(translated.geometry.elevationProfile.depth, 0.5)
  assert.ok(translated.bounds.max.x - translated.bounds.min.x > 0.5)

  const left = room('left', 0, 0)
  const right = room('right', 1, 1)
  const sharedEdge = roomBoundaryWallRuns(left).find(run => run.side === 'east')
  left.wallElevationProfiles = [{
    id: 'shared-profile',
    edgeKeys: sharedEdge.edgeKeys,
    profile: { type: 'faceted', depth: 0.75, direction: 1 },
  }]
  const sharedSnapshot = compileSurfaceWorld({
    battlemapId: 'map-profile-shared',
    surfaceData: emptySurface({ version: 10, rooms: { left, right } }),
  })
  const shared = sharedSnapshot.spatial.barriers.find(barrier => barrier.sourceIds?.length === 2)
  assert.equal(shared.geometry.elevationProfileMode, 'faces')
  assert.equal([shared.geometry.frontElevationProfile, shared.geometry.backElevationProfile].filter(Boolean).length, 1)
})

test('le compilateur oriente vers l intérieur tous les profils du contour', () => {
  const profiled = room('profiled', 0, 1, 0, 1)
  profiled.wallElevationProfiles = [{
    id: 'whole-contour-profile',
    edgeKeys: roomBoundaryWallRuns(profiled).flatMap(run => run.edgeKeys),
    profile: { type: 'curved', depth: 0.5, direction: 1 },
  }]
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-whole-contour-profile',
    surfaceData: emptySurface({ version: 10, rooms: { profiled } }),
  })
  const walls = snapshot.spatial.barriers.filter(barrier => (
    barrier.kind === 'wall'
    && barrier.geometry?.elevationProfileMode === 'translated'
  ))

  assert.ok(walls.length >= 4)
  for (const wall of walls) {
    const { from, to } = wall.geometry
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    const normal = { x: -dz / length, z: dx / length }
    const midpoint = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }
    const direction = Number(wall.geometry.elevationProfileDirection) < 0 ? -1 : 1
    const inwardDot = normal.x * direction * (1 - midpoint.x)
      + normal.z * direction * (1 - midpoint.z)
    assert.ok(inwardDot > 0, `profil compilé mal orienté sur ${wall.sourceId}`)
  }
})

test('les collisions ferment les extrémités d un mur profilé isolé', () => {
  const profiled = room('single-profile', 0, 1, 0, 1)
  const west = roomBoundaryWallRuns(profiled).find(run => run.side === 'west')
  profiled.wallElevationProfiles = [{
    id: 'single-wall-profile',
    edgeKeys: west.edgeKeys,
    profile: { type: 'curved', depth: 0.5, direction: 1 },
  }]
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-single-wall-profile',
    surfaceData: emptySurface({ version: 10, rooms: { profiled } }),
  })
  const walls = snapshot.spatial.barriers.filter(barrier => barrier.kind === 'wall')
  const profiledWalls = walls.filter(barrier => (
    barrier.geometry?.elevationProfileMode === 'translated'
  ))

  assert.ok(profiledWalls.some(barrier => (
    (Number(barrier.geometry.profileJoinStartPadding) || 0) > 0
    || (Number(barrier.geometry.profileJoinEndPadding) || 0) > 0
  )))
  const neighborExtensions = walls.flatMap(barrier => [
    Number(barrier.geometry?.profileJoinStartPadding) || 0,
    Number(barrier.geometry?.profileJoinEndPadding) || 0,
  ]).filter(padding => padding > 0.4)
  assert.ok(neighborExtensions.length >= 2)
})

test('un mur arrondi profilé conserve ses raccords dans la géométrie compilée', () => {
  const rounded = {
    ...room('rounded-profile', 0, 1, 0, 1),
    cells: ['0:0', '1:0', '0:1', '1:1'],
  }
  const runs = roomBoundaryWallRuns(rounded)
  const curvedEdges = runs
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  rounded.boundaryArcs = [{
    ...makeRoomBoundaryArc(rounded, curvedEdges, 90).arc,
    ownerRoomId: 'rounded-profile',
  }]
  rounded.wallElevationProfiles = [{
    id: 'profiled-contour',
    edgeKeys: runs.flatMap(wall => wall.edgeKeys),
    profile: { type: 'faceted', depth: 0.5, direction: 1 },
  }]
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-rounded-profile',
    surfaceData: emptySurface({ version: 10, rooms: { 'rounded-profile': rounded } }),
  })
  const arc = snapshot.spatial.barriers.find(barrier => barrier.geometry?.type === 'wall-arc')

  assert.equal(arc.geometry.elevationProfile.type, 'faceted')
  assert.ok(arc.geometry.profileJoinStartPadding > 0)
  assert.ok(arc.geometry.profileJoinEndPadding > 0)
  assert.deepEqual(
    [arc.geometry.from, arc.geometry.to]
      .map(point => `${point.x}:${point.z}`)
      .sort(),
    [rounded.boundaryArcs[0].start, rounded.boundaryArcs[0].end]
      .map(point => `${point.x}:${point.z}`)
      .sort(),
  )
})

test('le compilateur consomme le profil vertical canonique d une salle fusionnée', () => {
  const low = { ...room('low', 0, 0), cells: ['0:0'], heightLevels: 1 }
  const tall = { ...room('tall', 1, 1), cells: ['1:0'], heightLevels: 3, height: 7.5 }
  const mergedGeometry = {
    ...low,
    id: 'low',
    maxX: 1,
    cells: ['0:0', '1:0'],
    heightLevels: 3,
    height: 7.5,
  }
  const verticalProfile = buildMergedRoomVerticalProfile({
    mergedRoom: mergedGeometry,
    sourceRooms: [low, tall],
    roomLookup: { low, tall },
    storyHeight: 2.5,
  })
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-variable-height',
    surfaceData: emptySurface({
      version: 10,
      rooms: { low: { ...mergedGeometry, verticalProfile } },
    }),
  })

  const walls = snapshot.spatial.barriers.filter(item => item.kind === 'wall')
  const ceilings = snapshot.spatial.barriers.filter(item => item.kind === 'ceiling')
  assert.equal(walls.length, 14)
  assert.equal(ceilings.length, 2)
  assert.deepEqual(ceilings.map(item => item.bounds.min.y).sort((a, b) => a - b), [2.375, 7.375])
  assert.equal(snapshot.spatial.compartments[0].verticalProfile.length, 3)
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
          kind: 'straight',
          axis: 'x',
          dir: 1,
          x: 0.5,
          z: 0.5,
          y: 0,
          topY: 2.5,
          width: 1,
          treadDepth: 0.2,
          stepCount: 21,
          supportThickness: 0.25,
          railings: { left: false, right: false },
          walkable: true,
          movementMultiplier: 1.5,
        },
      },
    }),
  })
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'stairs')
  assert.deepEqual(traversal.from, { x: 0.5, y: 0.125, z: 0.5 })
  assert.deepEqual(traversal.to, { x: 4.7, y: 2.625, z: 0.5 })
  assert.equal(traversal.anchors.length, 22)
  assert.equal(traversal.allowPartial, true)
  assert.equal(traversal.movementMultiplier, 1.5)
  assert.equal(snapshot.spatial.colliders.filter(item => item.kind === 'stairs-solid').length, 21)
  assert.equal(snapshot.spatial.occluders.filter(item => item.kind === 'stairs-solid').length, 21)
})

test('un colimaçon compile une traversée courbe, des marches prismatiques et sa colonne centrale', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-spiral-stairs',
    surfaceData: emptySurface({
      stairs: {
        spiralA: {
          id: 'spiralA', kind: 'spiral', x: 2.5, z: 3.5, y: 0, topY: 2.5,
          outerRadius: 1.25, innerRadius: 0.22, totalTurns: 1.25,
          rotationQuarterTurns: 0, stepCount: 21, supportThickness: 0.25,
          treadThickness: 0.055, railings: { outer: true }, movementMultiplier: 1.25,
        },
      },
    }),
  })
  const traversal = snapshot.spatial.traversals.find(item => item.kind === 'stairs')
  const stepColliders = snapshot.spatial.colliders.filter(item => item.kind === 'stairs-solid')
  const column = snapshot.spatial.colliders.find(item => item.kind === 'stairs-column')

  assert.equal(traversal.anchors.length, 22)
  assert.equal(traversal.allowPartial, true)
  assert.equal(traversal.movementMultiplier, 1.25)
  assert.ok(new Set(traversal.anchors.map(anchor => `${anchor.x}:${anchor.z}`)).size > 8)
  assert.equal(stepColliders.length, 21)
  assert.equal(stepColliders.every(item => item.geometry?.type === 'horizontal-prism'), true)
  assert.equal(column.geometry.type, 'vertical-cylinder')
  assert.equal(snapshot.spatial.occluders.some(item => item.kind === 'stairs-column'), true)
})

test('la trémie paramétrique retire les colliders de sol et plafond au-dessus des marches', () => {
  const lower = room('lower', 0, 5)
  const upper = { ...room('upper', 0, 5), level: 1, y: 2.5 }
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-stair-opening',
    surfaceData: emptySurface({
      rooms: { lower, upper },
      stairs: {
        stairA: {
          id: 'stairA', kind: 'straight', axis: 'x', dir: 1,
          x: 0.5, z: 0.5, y: 0, topY: 2.5,
          width: 1, treadDepth: 0.2, stepCount: 21, supportThickness: 0.25,
          railings: { left: false, right: false },
        },
      },
    }),
  })
  const pointInsideOpening = { x: 3, y: 2.5, z: 0.5 }
  const horizontalBlockers = snapshot.spatial.colliders.filter(item => (
    ['floor', 'ceiling'].includes(item.kind)
      && pointInsideOpening.x >= item.bounds.min.x
      && pointInsideOpening.x <= item.bounds.max.x
      && pointInsideOpening.y >= item.bounds.min.y
      && pointInsideOpening.y <= item.bounds.max.y
      && pointInsideOpening.z >= item.bounds.min.z
      && pointInsideOpening.z <= item.bounds.max.z
  ))
  assert.deepEqual(horizontalBlockers, [])
})

test('le palier du colimaçon reste un support physique tandis que la volée haute reste ouverte', () => {
  const lower = room('lower', 0, 5, 0, 5)
  const upper = { ...room('upper', 0, 5, 0, 5), level: 1, y: 2.5 }
  const stair = {
    id: 'spiralA', kind: 'spiral', x: 2.5, z: 3.5, y: 0, topY: 2.5,
    outerRadius: 1.25, innerRadius: 0.22, totalTurns: 1.25,
    rotationQuarterTurns: 0, clockwise: false, stepCount: 21,
    supportThickness: 0.25, treadThickness: 0.055,
  }
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-spiral-landing',
    surfaceData: emptySurface({ rooms: { lower, upper }, stairs: { spiralA: stair } }),
  })
  const geometry = stairGeometry(stair)
  const endAngle = geometry.startAngle + geometry.sweep
  const tangent = { x: -Math.sin(endAngle), z: Math.cos(endAngle) }
  const landing = { x: geometry.end.x + tangent.x * 0.2, z: geometry.end.z + tangent.z * 0.2 }
  const upperFlight = { x: geometry.end.x - tangent.x * 0.2, z: geometry.end.z - tangent.z * 0.2 }
  const upperFloorSupports = snapshot.spatial.supports.filter(item => (
    item.kind === 'floor' && Math.abs(item.y - 2.625) < 1e-9
  ))

  assert.equal(upperFloorSupports.some(item => multiPolygonContainsPoint(item.footprint, landing)), true)
  assert.equal(upperFloorSupports.some(item => multiPolygonContainsPoint(item.footprint, upperFlight)), false)
  assert.equal(snapshot.spatial.colliders
    .filter(item => item.kind === 'floor' && Math.abs(item.bounds.max.y - 2.625) < 1e-9)
    .every(item => item.geometry?.type === 'horizontal-multipolygon'), true)
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
  assert.deepEqual(traversal.from, { x: 2.5, y: 0.125, z: 3.16 })
  assert.deepEqual(traversal.to, { x: 2.5, y: 5.125, z: 3.16 })
  assert.equal(traversal.mode, 'climb')
  assert.equal(traversal.allowPartial, true)
  assert.equal(traversal.anchorSpacing, 0.5)
  assert.equal(traversal.movementMultiplier, 2)
})

test('une échelle sans trappe découpe sa trémie et expose ses raccords de palier', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-ladder-open-shaft',
    surfaceData: emptySurface({
      floors: {
        '0:0:0': { x: 0, z: 0, y: 0, thickness: 0.25 },
        '0:0:2.5': { x: 0, z: 0, y: 2.5, thickness: 0.25, kind: 'bridge' },
        '1:0:2.5': { x: 1, z: 0, y: 2.5, thickness: 0.25, kind: 'bridge' },
      },
      connectors: {
        ladderA: {
          id: 'ladderA', type: 'ladder', x: 0, z: 0, axis: 'x',
          fromLevel: 0, toLevel: 1, fromY: 0.125, toY: 2.625,
          topOpening: { shape: 'rectangle', x: 0, z: 0, y: 2.5, width: 1, depth: 1 },
        },
      },
    }),
  })
  assert.equal(snapshot.spatial.traversals.find(item => item.kind === 'ladder').enabled, true)
  assert.equal(snapshot.spatial.supports.some(item => (
    item.kind === 'floor' && item.bounds.min.x === 0 && Math.abs(item.y - 2.625) < 1e-9
  )), false)
  const landings = snapshot.spatial.supports.filter(item => item.kind === 'ladder-landing')
  assert.equal(landings.length, 1)
  assert.deepEqual(landings[0].point, { x: 0.5, y: 2.625, z: 0.16 })
})

test('une trappe fermée remplace la dalle et verrouille la traversée de son échelle', () => {
  const surfaceData = emptySurface({
    rooms: {
      lower: room('lower', 0, 0),
      upper: { ...room('upper', 0, 0), level: 1, y: 2.5 },
    },
    connectors: {
      ladderA: {
        id: 'ladderA', type: 'ladder', x: 0, z: 0,
        fromLevel: 0, toLevel: 1, fromY: 0.125, toY: 2.625,
      },
      hatchA: {
        id: 'hatchA', type: 'hatch', linkedLadderId: 'ladderA',
        x: 0, z: 0, y: 2.5, width: 1, depth: 1, height: 0.25,
        axis: 'x', hingeSide: 1, state: 'closed',
        allowedStates: ['closed', 'open', 'locked'],
        barrierType: 'solid', blocksMovement: true, blocksSight: true, blocksWater: true,
      },
    },
  })
  const closed = compileSurfaceWorld({ battlemapId: 'map-ladder-hatch', surfaceData })
  const traversal = closed.spatial.traversals.find(item => item.kind === 'ladder')
  const hatchSupport = closed.spatial.supports.find(item => item.kind === 'hatch')

  assert.equal(traversal.enabled, false)
  assert.equal(traversal.gateFeatureId, hatchSupport.sourceId)
  assert.equal(traversal.gateState, 'closed')
  assert.ok(closed.spatial.colliders.some(item => item.kind === 'hatch'))
  assert.ok(closed.spatial.occluders.some(item => item.kind === 'hatch'))
  assert.equal(closed.spatial.supports.some(item => item.kind === 'floor' && Math.abs(item.y - 2.625) < 1e-9), false)

  const opened = compileSurfaceWorld({
    battlemapId: 'map-ladder-hatch',
    surfaceData,
    runtimeState: { featureStates: { [hatchSupport.sourceId]: { state: 'open' } } },
  })
  assert.equal(opened.spatial.traversals.find(item => item.kind === 'ladder').enabled, true)
  assert.equal(opened.spatial.supports.some(item => item.kind === 'hatch'), false)
  assert.equal(opened.spatial.colliders.some(item => item.kind === 'hatch'), false)
  assert.equal(opened.spatial.occluders.some(item => item.kind === 'hatch'), false)
})

test('une trappe en grille fermée reste un support sans occulter la LOS', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-grate-hatch',
    surfaceData: emptySurface({
      connectors: {
        ladderA: {
          id: 'ladderA', type: 'ladder', x: 1, z: 2,
          fromLevel: 0, toLevel: 1, fromY: 0.125, toY: 2.625,
        },
        hatchA: {
          id: 'hatchA', type: 'hatch', linkedLadderId: 'ladderA',
          x: 1, z: 2, y: 2.5, width: 1, depth: 1, height: 0.12,
          axis: 'z', hingeSide: -1, state: 'closed',
          allowedStates: ['closed', 'open', 'locked'],
          barrierType: 'grate', blocksMovement: true, blocksSight: false, blocksWater: false,
        },
      },
    }),
  })
  assert.ok(snapshot.spatial.supports.some(item => item.kind === 'hatch'))
  assert.ok(snapshot.spatial.colliders.some(item => item.kind === 'hatch'))
  assert.equal(snapshot.spatial.occluders.some(item => item.kind === 'hatch'), false)
})

test('une trappe ronde compile un support circulaire et non sa boîte englobante', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-round-hatch',
    surfaceData: emptySurface({
      connectors: {
        ladderA: {
          id: 'ladderA', type: 'ladder', x: 0, z: 0, axis: 'x',
          fromLevel: 0, toLevel: 1, fromY: 0.125, toY: 2.625,
          topOpening: { shape: 'circle', x: 0, z: 0, y: 2.5, width: 1, depth: 1 },
        },
        hatchA: {
          id: 'hatchA', type: 'hatch', linkedLadderId: 'ladderA', openingShape: 'circle',
          x: 0, z: 0, y: 2.5, width: 1, depth: 1, height: 0.12,
          axis: 'x', hingeSide: 1, state: 'closed', allowedStates: ['closed', 'open', 'locked'],
        },
      },
    }),
  })
  const support = snapshot.spatial.supports.find(item => item.kind === 'hatch')
  assert.equal(multiPolygonContainsPoint(support.footprint, { x: 0.5, z: 0.5 }), true)
  assert.equal(multiPolygonContainsPoint(support.footprint, { x: 0.02, z: 0.02 }), false)
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

test('une gaine orthogonale peut tourner à un arrêt et le verre reste transparent à la LOS', () => {
  const surfaceData = emptySurface({
    connectors: {
      routedLift: {
        id: 'routedLift', type: 'elevator', x: 0, z: 0, fromLevel: 0, toLevel: 1,
        width: 2, depth: 1, elevatorStyle: 'glass', initialStopId: 'a',
        stops: [
          { id: 'a', level: 0, x: 0, y: 0.125, z: 0, doorAxis: 'z', doorSide: 1 },
          { id: 'b', level: 1, x: 0, y: 2.625, z: 0, doorAxis: 'x', doorSide: -1 },
          { id: 'c', level: 1, x: 4, y: 2.625, z: 0, doorAxis: 'z', doorSide: -1 },
        ],
      },
    },
  })
  const snapshot = compileSurfaceWorld({ battlemapId: 'map-routed-lift', surfaceData })
  const shaft = snapshot.spatial.barriers.filter(item => item.kind === 'elevator-shaft')
  assert.ok(shaft.some(item => item.axis === 'horizontal'))
  assert.ok(shaft.every(item => item.blocks.water && item.blocks.movement && !item.blocks.sight))
  assert.equal(snapshot.spatial.occluders.some(item => item.kind === 'elevator-shaft'), false)
  const landingDoors = snapshot.spatial.barriers.filter(item => item.kind === 'elevator-landing-door')
  assert.deepEqual(landingDoors.map(item => item.axis), ['x', 'z'])
})

test('la compilation est déterministe pour une même entrée', () => {
  const args = {
    battlemapId: 'map-deterministic',
    worldRevision: 9,
    surfaceData: emptySurface({ rooms: { roomA: room('roomA', 0, 1) } }),
  }
  assert.deepEqual(compileSurfaceWorld(args), compileSurfaceWorld(args))
})

test('une passerelle suit l intérieur réel d un mur profilé', () => {
  const profiledRoom = room('profiled-room', 0, 0)
  profiledRoom.heightLevels = 2
  profiledRoom.height = 5
  const north = roomBoundaryWallRuns(profiledRoom).find(wall => wall.side === 'north')
  profiledRoom.wallElevationProfiles = [{
    id: 'north-profile',
    edgeKeys: north.edgeKeys,
    profile: { type: 'curved', depth: 0.4, direction: 1 },
  }]
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-profiled-bridge',
    surfaceData: emptySurface({
      rooms: { 'profiled-room': profiledRoom },
      floors: {
        '0:0:2.5': {
          id: 'profiled-bridge', kind: 'bridge', runtimeSupport: true,
          x: 0, z: 0, y: 2.5, thickness: 0.25, walkable: true,
          clipRoomId: 'profiled-room',
        },
      },
    }),
  })
  const bridge = snapshot.spatial.supports.find(item => item.kind === 'bridge')
  assert.ok(bridge)
  assert.ok(bridge.bounds.min.z > 0.35)
  assert.ok(Array.isArray(bridge.footprint))
  assert.ok(bridge.point.z >= bridge.bounds.min.z)
})

test('une passerelle est découpée par l arc canonique de la salle', () => {
  const roundedRoom = {
    ...room('rounded-bridge-room', 0, 1, 0, 1),
    cells: ['0:0', '1:0', '0:1', '1:1'],
  }
  const runs = roomBoundaryWallRuns(roundedRoom)
  const curvedEdges = runs
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  roundedRoom.boundaryArcs = [{
    ...makeRoomBoundaryArc(roundedRoom, curvedEdges, 90).arc,
    ownerRoomId: roundedRoom.id,
  }]
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-rounded-bridge',
    surfaceData: emptySurface({
      rooms: { [roundedRoom.id]: roundedRoom },
      floors: {
        '0:0:1.25': {
          id: 'rounded-bridge', kind: 'bridge', runtimeSupport: true,
          x: 0, z: 0, y: 1.25, thickness: 0.25, walkable: true,
          clipRoomId: roundedRoom.id,
        },
      },
    }),
  })
  const bridge = snapshot.spatial.supports.find(item => item.kind === 'bridge')

  assert.ok(bridge)
  assert.ok(multiPolygonArea(bridge.footprint) > 0)
  assert.ok(multiPolygonArea(bridge.footprint) < 0.5)
  assert.ok(bridge.point.x >= bridge.bounds.min.x && bridge.point.x <= bridge.bounds.max.x)
  assert.ok(bridge.point.z >= bridge.bounds.min.z && bridge.point.z <= bridge.bounds.max.z)
})

test('une fenêtre transparente découpe le mur sans créer de traversée et laisse passer la vue', () => {
  const featureId = '11111111-1111-5111-8111-111111111111'
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-window',
    surfaceData: emptySurface({
      rooms: { roomA: room('roomA', 0, 1) },
      connectors: {
        window: {
          id: 'window', worldId: featureId, type: 'window', axis: 'x', level: 0,
          x0: 2, x1: 6, z0: 0, z1: 0, alongCenter: 4, y: 0.5,
          width: 1, depth: 0.08, height: 1.5, thickness: 1,
          modelGeometry: { openingWidth: 1, wallCutWidth: 1, height: 1.5 },
          state: 'transparent',
        },
      },
    }),
  })
  const windowBarrier = snapshot.spatial.barriers.find(item => item.kind === 'window')

  assert.ok(windowBarrier)
  assert.deepEqual(windowBarrier.blocks, { movement: true, sight: false, water: true, gas: true })
  assert.equal(snapshot.spatial.traversals.some(item => item.sourceId === featureId), false)
  assert.equal(snapshot.spatial.occluders.some(item => item.sourceId === featureId), false)
})

test('les états opaque et miroir d’une fenêtre-écran bloquent la vue via l’état runtime', () => {
  const featureId = '22222222-2222-5222-8222-222222222222'
  const surfaceData = emptySurface({
    rooms: { roomA: room('roomA', 0, 1) },
    connectors: {
      screen: {
        id: 'screen', worldId: featureId, type: 'screen-window', axis: 'x', level: 0,
        x0: 2, x1: 6, z0: 0, z1: 0, alongCenter: 4, y: 0.5,
        width: 1, depth: 0.1, height: 1.5, thickness: 1,
        modelGeometry: { openingWidth: 1, wallCutWidth: 1, height: 1.5 },
        state: 'transparent', allowedStates: ['transparent', 'opaque', 'mirror'],
      },
    },
  })
  for (const state of ['opaque', 'mirror']) {
    const snapshot = compileSurfaceWorld({
      battlemapId: `map-screen-${state}`,
      surfaceData,
      runtimeState: { featureStates: { [featureId]: { state } } },
    })
    const barrier = snapshot.spatial.barriers.find(item => item.kind === 'screen-window')
    assert.equal(barrier.blocks.sight, true)
    assert.ok(snapshot.spatial.occluders.some(item => item.sourceId === featureId))
  }
})

test('une verrière remplace la dalle opaque par un support transparent praticable', () => {
  const featureId = '33333333-3333-5333-8333-333333333333'
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-skylight',
    surfaceData: emptySurface({
      rooms: { roomA: room('roomA', 0, 1, 0, 1) },
      connectors: {
        skylight: {
          id: 'skylight', worldId: featureId, type: 'skylight',
          x: 0, z: 0, y: 0, width: 2, depth: 2, height: 0.1,
        },
      },
    }),
  })
  const support = snapshot.spatial.supports.find(item => item.kind === 'skylight')
  const barrier = snapshot.spatial.barriers.find(item => item.kind === 'skylight')

  assert.ok(support?.walkable)
  assert.deepEqual(barrier.blocks, { movement: true, sight: false, water: true, gas: true })
  assert.equal(snapshot.spatial.occluders.some(item => item.sourceId === featureId), false)
  assert.equal(snapshot.spatial.supports.filter(item => item.kind === 'floor').length, 0)
})
