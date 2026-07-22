import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SURFACE_DATA_VERSION,
  applyRoomBoundaryArc,
  applyBridgeSelection,
  applyLadderConnector,
  applyRoomWallAppearance,
  applyRoomWallElevationProfile,
  applyRoomSelection,
  applyRoomSelectionWithResult,
  computeSurfaceWaterCells,
  deleteRoomBoundaryWalls,
  deleteSurfaceRoom,
  eraseSurfaceSelection,
  expandRoomsToSurface,
  findRoomAtCell,
  getRoomFootprintCells,
  getRoomBoundaryWallRuns,
  getWallRenderBox,
  isWorldPointVisibleAtLevel,
  isWorldInteriorPointVisibleAtLevel,
  entityUsesWallPlacement,
  makeDoorConnectorFromWallPoint,
  makeSpiralStairFromCell,
  makeStraightStairFromCell,
  makeSkylightConnectorFromCell,
  makeWallsFromDrag,
  roomFootprintRectangles,
  roomsWallRenderPaths,
  roomsWallSegments,
  wallOpeningVerticalRange,
  wallProfileVerticalProgresses,
} from './surfaceData.js'
import {
  multiPolygonContainsPoint,
  multiPolygonGridCells,
  roomGeometryArea,
  roomGeometryIntersectionArea,
} from '../../../shared/world/roomGeometry.js'
import { prepareSurfaceData } from '../../../shared/world/surfaceDocument.js'
import { spiralStairGeometry, straightStairGeometry } from '../../../shared/world/stairGeometry.js'
import { industrialGrateOpacityAt } from './proceduralMaterials.js'

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

function room(id, level, heightLevels = 1) {
  return {
    id,
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    level,
    y: level * 2.5,
    heightLevels,
    floorEnabled: true,
    wallEnabled: true,
    ceilingEnabled: true,
    floorThickness: 0.25,
    wallThickness: 1,
    ceilingThickness: 0.25,
    blocksWater: true,
  }
}

test('le motif de grille alterne métal opaque et ajours totalement transparents', () => {
  assert.equal(industrialGrateOpacityAt(0, 0), 1)
  assert.equal(industrialGrateOpacityAt(1 / 12, 1 / 8), 0)
  assert.equal(industrialGrateOpacityAt(1, 1), 1)
})

test('la surface extérieure de l eau reste cinq étages au-dessus du sommet global', () => {
  const result = computeSurfaceWaterCells(emptySurface({
    rooms: {
      low: room('low', 0),
      high: room('high', 2),
    },
  }))

  assert.ok(result.waterCells.length > 0)
  assert.deepEqual([...new Set(result.waterCells.map(cell => cell.topY))], [20.125])
  assert.equal(result.exteriorSurface.y, 20.125)
})

test('la surface extérieure de l eau reste au-dessus du toit d une salle multi-niveau', () => {
  const result = computeSurfaceWaterCells(emptySurface({
    rooms: {
      tower: room('tower', 0, 3),
      annex: room('annex', 0, 1),
    },
  }))

  assert.ok(result.waterCells.length > 0)
  assert.deepEqual([...new Set(result.waterCells.map(cell => cell.topY))], [20.125])
  assert.equal(result.exteriorSurface.y, 20.125)
})

test('la surface océanique reste un rectangle continu au-dessus des salles sèches', () => {
  const result = computeSurfaceWaterCells(emptySurface({
    rooms: {
      sealed: room('sealed', 0),
    },
  }))

  assert.deepEqual(result.exteriorSurface, {
    x: -3,
    z: -3,
    width: 8,
    depth: 8,
    y: 15.125,
  })
  assert.ok(result.dryCellKeys.size > 0)
})

test('un escalier droit calcule des marches réalistes sans dépendre de la longueur tracée', () => {
  const stair = makeStraightStairFromCell(
    emptySurface(),
    { x: 2, z: 3 },
    { level: 0, stairWidthM: 1.5, stairTreadDepthM: 0.3, stairMaxRiserHeightM: 0.18 },
    null,
    [],
  )
  const geometry = straightStairGeometry(stair)

  assert.equal(stair.kind, 'straight')
  assert.equal(stair.stepCount, 21)
  assert.equal(geometry.run, 4.2)
  assert.ok(geometry.riserHeight * 1.5 <= 0.18)
  assert.equal(geometry.anchors.length, 22)
  assert.deepEqual(geometry.start, { x: 2.5, y: 0.125, z: 3.5 })
  assert.deepEqual(geometry.end, { x: 6.7, y: 2.625, z: 3.5 })
})

test('la rotation avant pose utilise exactement les quatre orientations de l escalier sauvegardé', () => {
  const orientations = [
    { stairQuarterTurns: 0, axis: 'x', dir: 1 },
    { stairQuarterTurns: 1, axis: 'z', dir: 1 },
    { stairQuarterTurns: 2, axis: 'x', dir: -1 },
    { stairQuarterTurns: 3, axis: 'z', dir: -1 },
  ]

  for (const expected of orientations) {
    const stair = makeStraightStairFromCell(
      emptySurface(),
      { x: 2, z: 3 },
      { level: 0, stairQuarterTurns: expected.stairQuarterTurns },
      null,
      [],
    )
    assert.equal(stair.axis, expected.axis)
    assert.equal(stair.dir, expected.dir)
  }
})

test('un colimaçon dérive ses marches, son entrée et sa trémie depuis une seule définition', () => {
  const stair = makeSpiralStairFromCell(
    emptySurface(),
    { x: 2, z: 3 },
    { level: 0, stairQuarterTurns: 1, stairOuterDiameterM: 3.75 },
    null,
    [],
  )
  const geometry = spiralStairGeometry(stair)

  assert.equal(stair.kind, 'spiral')
  assert.equal(stair.rotationQuarterTurns, 1)
  assert.equal(geometry.stepCount, 21)
  assert.equal(geometry.anchors.length, 22)
  assert.equal(geometry.steps.every(step => step.polygon.length === 10), true)
  assert.equal(geometry.diameter, 2.5)
  assert.equal(geometry.openingBounds.minX, 1.21)
  assert.equal(geometry.openingBounds.maxX, 3.79)
  assert.ok(Math.abs(geometry.start.x - 2.5) < 1e-9)
  assert.ok(geometry.start.z > 3.5)
  assert.deepEqual(geometry.end.y, 2.625)
  assert.ok(geometry.column.bounds.max.y > geometry.topSurfaceY)
})

test('la trémie d un colimaçon conserve le palier dans les deux sens et quatre orientations', () => {
  for (const clockwise of [false, true]) {
    for (let rotationQuarterTurns = 0; rotationQuarterTurns < 4; rotationQuarterTurns += 1) {
      const geometry = spiralStairGeometry({
        kind: 'spiral', x: 2.5, z: 3.5, y: 0, topY: 2.5,
        outerRadius: 1.25, innerRadius: 0.22, totalTurns: 1.25,
        rotationQuarterTurns, clockwise, stepCount: 21,
        supportThickness: 0.25, treadThickness: 0.055,
      })
      const endAngle = geometry.startAngle + geometry.sweep
      const directionSign = Math.sign(geometry.sweep)
      const tangent = {
        x: -Math.sin(endAngle) * directionSign,
        z: Math.cos(endAngle) * directionSign,
      }
      const landing = {
        x: geometry.end.x + tangent.x * 0.2,
        z: geometry.end.z + tangent.z * 0.2,
      }
      const upperFlight = {
        x: geometry.end.x - tangent.x * 0.2,
        z: geometry.end.z - tangent.z * 0.2,
      }

      assert.equal(multiPolygonContainsPoint(geometry.openingMultiPolygon, landing), false)
      assert.equal(multiPolygonContainsPoint(geometry.openingMultiPolygon, upperFlight), true)
    }
  }
})

test('une passerelle se pose avec les apparences canoniques Sol et Plafond', () => {
  const surface = emptySurface()
  const next = applyBridgeSelection(surface, {
    start: { x: 2, z: 3 },
    end: { x: 2, z: 3 },
  }, {
    mode: 'bridge',
    level: 1,
    elevation: 2.5,
    floorThickness: 0.25,
    movementMultiplier: 1,
    surfaceBlocking: 'solid',
    surfaceMaterialMode: 'procedural',
    materialProfiles: {
      floor: { material: 'wood', paint: '#123456', wear: 0, dirt: 0, relief: 0 },
      ceiling: { material: 'concrete', paint: '#654321', wear: 0, dirt: 0, relief: 0 },
    },
  }, null, [])
  const bridge = next.floors['2:3:2.5']

  assert.ok(bridge)
  assert.equal(bridge.kind, 'bridge')
  assert.equal(bridge.topMaterial.material, 'wood')
  assert.equal(bridge.topMaterial.paint, '#123456')
  assert.equal(bridge.bottomMaterial.material, 'concrete')
  assert.equal(bridge.bottomMaterial.paint, '#654321')
})

test('une échelle crée sa trappe supérieure avec le même matériau ajouré', () => {
  const lower = room('lower', 0)
  const upper = { ...room('upper', 1), y: 2.5, level: 1 }
  const next = applyLadderConnector(emptySurface({ rooms: { lower, upper } }), { x: 0, z: 0 }, {
    level: 0,
    connectorToLevel: 1,
    ladderHatch: true,
    ladderAxis: 'x',
    floorThickness: 0.25,
    surfaceBlocking: 'grate',
    surfaceMaterialMode: 'procedural',
    materialPreset: {
      material: 'steel',
      paint: '#66737a',
      pattern: 'industrial_grate',
      wear: 35,
      dirt: 25,
      relief: 70,
    },
  })
  const ladder = Object.values(next.connectors).find(connector => connector.type === 'ladder')
  const hatch = Object.values(next.connectors).find(connector => connector.type === 'hatch')

  assert.ok(ladder)
  assert.ok(hatch)
  assert.equal(hatch.linkedLadderId, ladder.id)
  assert.equal(hatch.y, 2.5)
  assert.equal(hatch.height, 0.25)
  assert.equal(hatch.state, 'closed')
  assert.equal(hatch.barrierType, 'grate')
  assert.equal(hatch.blocksSight, false)
  assert.equal(hatch.material.pattern, 'industrial_grate')
  assert.equal(hatch.material.alphaMode, 'cutout')
  const prepared = prepareSurfaceData(next, { battlemapId: 'map-ladder-hatch' })
  const preparedHatch = Object.values(prepared.surfaceData.connectors).find(connector => connector.type === 'hatch')
  assert.ok(preparedHatch.worldId)
  assert.equal(prepared.worldDocument.features.connectors[preparedHatch.worldId].type, 'hatch')

  const erasedFromLowerLevel = eraseSurfaceSelection(
    next,
    { start: { x: 0, z: 0 }, end: { x: 0, z: 0 } },
    { level: 0 },
  )
  assert.equal(Object.values(erasedFromLowerLevel.connectors).some(connector => connector.type === 'ladder'), false)
  assert.equal(Object.values(erasedFromLowerLevel.connectors).some(connector => connector.type === 'hatch'), false)
})

test('un mur courbe produit des segments orientés avec une boîte de rendu tournée', () => {
  const walls = makeWallsFromDrag(
    { fx: 0, fz: 0 },
    { fx: 16, fz: 0 },
    { wallShape: 'curve', wallCurveOffset: 2, wallHeightLevels: 1, level: 0 },
    null,
    [],
  )

  assert.ok(walls.length > 4)
  assert.ok(walls.every(wall => wall.axis === 'segment'))
  assert.ok(walls.some(wall => Math.abs(getWallRenderBox(wall).rotationY) > 0.01))
  assert.equal(walls[0].x0, 0)
  assert.equal(walls.at(-1).x1, 16)
})

test('un profil vertical extérieur translate les deux faces du mur', () => {
  const exteriorRoom = room('outside', 0)
  const west = getRoomBoundaryWallRuns(exteriorRoom).find(run => run.side === 'west')
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { outside: exteriorRoom } }),
    'outside',
    west.edgeKeys,
    { type: 'curved', depth: 0.6, direction: 1 },
  )

  assert.equal(result.error, null)
  const profiled = roomsWallSegments(result.surfaceData.rooms).find(wall => wall.elevationProfileMode)
  assert.equal(profiled.elevationProfileMode, 'translated')
  assert.equal(profiled.elevationProfile.depth, 0.6)
  assert.equal(profiled.roomIds.length, 1)
})

test('un mur profile se raccorde aussi a ses voisins restes verticaux', () => {
  const exteriorRoom = room('single-profile', 0)
  const west = getRoomBoundaryWallRuns(exteriorRoom).find(run => run.side === 'west')
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { 'single-profile': exteriorRoom } }),
    'single-profile',
    west.edgeKeys,
    { type: 'curved', depth: 0.6, direction: 1 },
  )
  const walls = roomsWallRenderPaths(result.surfaceData.rooms)
  const profiled = walls.filter(wall => wall.elevationProfileMode === 'translated')
  const joins = profiled.flatMap(wall => [wall.profileJoinStart, wall.profileJoinEnd]).filter(Boolean)

  assert.equal(result.error, null)
  assert.equal(joins.length, 2)
  assert.ok(joins.every(join => join.neighbor.elevationProfileMode === undefined))
  const straightNeighbor = walls.find(wall => (
    !wall.elevationProfileMode
    && [wall.profileJoinStart, wall.profileJoinEnd].some(join => (
      join?.front?.neighbor?.elevationProfileMode
      || join?.back?.neighbor?.elevationProfileMode
    ))
  ))
  const neighborLevels = wallProfileVerticalProgresses(straightNeighbor)
  assert.ok(neighborLevels.length > 2)
  assert.ok(neighborLevels.includes(0.5))
})

test('le profil vers l intérieur garde la même orientation sur tout le contour', () => {
  const profiledRoom = room('profiled', 0)
  const edgeKeys = getRoomBoundaryWallRuns(profiledRoom).flatMap(run => run.edgeKeys)
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { profiled: profiledRoom } }),
    'profiled',
    edgeKeys,
    { type: 'curved', depth: 0.5, direction: 1 },
  )
  const center = { x: 4, z: 4 }
  const walls = roomsWallSegments(result.surfaceData.rooms)
    .filter(wall => wall.elevationProfileMode === 'translated')

  assert.ok(walls.length >= 4)
  for (const wall of walls) {
    const dx = Number(wall.x1) - Number(wall.x0)
    const dz = Number(wall.z1) - Number(wall.z0)
    const length = Math.hypot(dx, dz)
    const normal = { x: -dz / length, z: dx / length }
    const midpoint = {
      x: (Number(wall.x0) + Number(wall.x1)) / 2,
      z: (Number(wall.z0) + Number(wall.z1)) / 2,
    }
    const direction = Number(wall.elevationProfileDirection) < 0 ? -1 : 1
    const inwardDot = normal.x * direction * (center.x - midpoint.x)
      + normal.z * direction * (center.z - midpoint.z)
    assert.ok(inwardDot > 0, `profil mal orienté sur ${wall.id}`)
  }
  const renderWalls = roomsWallRenderPaths(result.surfaceData.rooms)
    .filter(wall => wall.elevationProfileMode === 'translated')
  const cornerJoins = renderWalls
    .flatMap(wall => [wall.profileJoinStart, wall.profileJoinEnd])
    .filter(Boolean)
  assert.ok(cornerJoins.length >= 4)
})

test('un contour arrondi conserve son profil vertical et ses raccords', () => {
  const baseRoom = { ...room('rounded-profile', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const allEdges = getRoomBoundaryWallRuns(baseRoom).flatMap(wall => wall.edgeKeys)
  const curvedEdges = getRoomBoundaryWallRuns(baseRoom)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const profiled = applyRoomWallElevationProfile(
    emptySurface({ rooms: { 'rounded-profile': baseRoom } }),
    'rounded-profile',
    allEdges,
    { type: 'faceted', depth: 0.5, direction: 1 },
  )
  const curved = applyRoomBoundaryArc(
    profiled.surfaceData,
    'rounded-profile',
    curvedEdges,
    90,
  )
  const arc = roomsWallRenderPaths(curved.surfaceData.rooms).find(wall => wall.axis === 'arc')

  assert.equal(curved.error, null)
  assert.equal(arc.elevationProfile.type, 'faceted')
  assert.equal(arc.elevationProfile.depth, 0.5)
  assert.ok(arc.profileJoinStartMiter)
  assert.ok(arc.profileJoinEndMiter)
})

test('un grand arc profile reste raccorde exactement aux murs droits', () => {
  const largeRoom = {
    ...room('large-rounded-profile', 0),
    minX: -6,
    maxX: 2,
    minZ: -1,
    maxZ: 9,
    cells: Array.from({ length: 11 }, (_, dz) => (
      Array.from({ length: 9 }, (_, dx) => `${-6 + dx}:${-1 + dz}`)
    )).flat(),
  }
  const curvedEdges = getRoomBoundaryWallRuns(largeRoom)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const profiled = applyRoomWallElevationProfile(
    emptySurface({ rooms: { 'large-rounded-profile': largeRoom } }),
    'large-rounded-profile',
    curvedEdges,
    { type: 'curved', depth: 0.25, direction: -1 },
  )
  const rounded = applyRoomBoundaryArc(
    profiled.surfaceData,
    'large-rounded-profile',
    curvedEdges,
    90,
  )
  const arc = roomsWallRenderPaths(rounded.surfaceData.rooms).find(wall => wall.axis === 'arc')

  assert.equal(profiled.error, null)
  assert.equal(rounded.error, null)
  assert.ok(arc.profileJoinStart)
  assert.ok(arc.profileJoinEnd)
})

test('une porte rigide bloque le changement de profil vertical de son mur', () => {
  const guardedRoom = room('guarded', 0)
  const west = getRoomBoundaryWallRuns(guardedRoom).find(run => run.side === 'west')
  const result = applyRoomWallElevationProfile(
    emptySurface({
      rooms: { guarded: guardedRoom },
      connectors: {
        door: { type: 'door', axis: 'z', x0: 0, x1: 0, z0: 0, z1: 4, y: 0 },
      },
    }),
    'guarded',
    west.edgeKeys,
    { type: 'curved', depth: 0.6, direction: 1 },
  )

  assert.match(result.error, /ouverture rigide/i)
  assert.equal(result.surfaceData.rooms.guarded.wallElevationProfiles, undefined)
})

test('un profil vertical mitoyen ne modifie que la face de la salle sélectionnée', () => {
  const left = { ...room('left', 0), maxX: 0, maxZ: 0, cells: ['0:0'] }
  const right = { ...room('right', 0), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'] }
  const east = getRoomBoundaryWallRuns(left).find(run => run.side === 'east')
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { left, right } }),
    'left',
    east.edgeKeys,
    { type: 'faceted', depth: 0.75, direction: 1 },
  )

  assert.equal(result.error, null)
  assert.equal(result.surfaceData.rooms.right.wallElevationProfiles, undefined)
  const shared = roomsWallSegments(result.surfaceData.rooms).find(wall => wall.roomIds.length === 2)
  assert.equal(shared.elevationProfileMode, 'faces')
  assert.equal([shared.frontElevationProfile, shared.backElevationProfile].filter(Boolean).length, 1)
  const renderedShared = roomsWallRenderPaths(result.surfaceData.rooms)
    .find(wall => wall.roomIds.length === 2)
  const junctions = [renderedShared.profileJoinStart, renderedShared.profileJoinEnd]
  assert.ok(junctions.every(Boolean))
  for (const junction of junctions) {
    for (const side of ['front', 'back']) {
      const ownRoomIds = new Set(renderedShared[`${side}RoomIds`] || [])
      const faceJoin = junction[side]
      const neighborRoomIds = faceJoin.neighbor[`${faceJoin.neighborSide}RoomIds`] || []
      assert.ok(neighborRoomIds.some(roomId => ownRoomIds.has(roomId)))
    }
  }
})

test('une apparence de mur reste attachée aux arêtes sélectionnées sans modifier les autres murs', () => {
  const styledRoom = {
    ...room('styled', 0),
    wallInteriorMaterial: { material: 'concrete', paint: '#666666', pattern: 'none', wear: 0, dirt: 0, relief: 0 },
  }
  const west = getRoomBoundaryWallRuns(styledRoom).find(run => run.side === 'west')
  const result = applyRoomWallAppearance(
    emptySurface({ rooms: { styled: styledRoom } }),
    'styled',
    west.edgeKeys,
    {
      interiorMaterial: { material: 'steel', paint: '#ff0000', pattern: 'metal_panels', wear: 25, dirt: 12, relief: 40 },
    },
  )

  assert.equal(result.error, null)
  assert.equal(result.surfaceData.version, SURFACE_DATA_VERSION)
  assert.deepEqual(result.surfaceData.rooms.styled.wallAppearanceProfiles[0].edgeKeys, west.edgeKeys)
  const walls = roomsWallSegments(result.surfaceData.rooms)
  const westWall = walls.find(wall => wall.x0 === 0 && wall.x1 === 0)
  const northWall = walls.find(wall => wall.z0 === 0 && wall.z1 === 0)
  assert.ok([westWall.frontMaterial, westWall.backMaterial].some(material => material?.paint === '#ff0000'))
  assert.equal([northWall.frontMaterial, northWall.backMaterial].some(material => material?.paint === '#ff0000'), false)
})

test('l enveloppe extérieure conserve les niveaux inférieurs sans transparence contextuelle', () => {
  const surface = emptySurface({
    rooms: {
      well: room('well', 0, 3),
    },
  })

  assert.equal(isWorldPointVisibleAtLevel(surface, 2, 0.5, 0.5, 0), true)
  assert.equal(isWorldPointVisibleAtLevel(surface, 2, 4.5, 4.5, 0), true)
  assert.equal(isWorldPointVisibleAtLevel(surface, 1, 0.5, 0.5, 5), false)
  assert.equal(isWorldPointVisibleAtLevel(surface, 2, 4.5, 4.5, 5), true)
  assert.equal(isWorldPointVisibleAtLevel(surface, 0, 0.5, 0.5, 5, 'well'), true)
  assert.equal(isWorldPointVisibleAtLevel(surface, 0, 4.5, 4.5, 5, 'well'), false)
})

test('le contenu inférieur reste rendu derrière les parois opaques et le volume actif révèle aussi son sommet', () => {
  const surface = emptySurface({
    rooms: {
      well: room('well', 0, 3),
    },
  })

  assert.equal(isWorldInteriorPointVisibleAtLevel(surface, 2, 4.5, 4.5, 0), true)
  assert.equal(isWorldInteriorPointVisibleAtLevel(surface, 2, 4.5, 4.5, 5), true)
  assert.equal(isWorldInteriorPointVisibleAtLevel(surface, 2, 0.5, 0.5, 0, 'well'), true)
  assert.equal(isWorldInteriorPointVisibleAtLevel(surface, 0, 0.5, 0.5, 5, 'well'), true)
  assert.equal(isWorldInteriorPointVisibleAtLevel(surface, 0, 4.5, 4.5, 5, 'well'), false)
})

test('un objet mural est reconnu par son instance ou son blueprint', () => {
  assert.equal(entityUsesWallPlacement({ state: { placement: { mode: 'wall' } } }, null), true)
  assert.equal(entityUsesWallPlacement({}, { geometry: { placementMode: 'wall' } }), true)
  assert.equal(entityUsesWallPlacement({}, { geometry: { placement_mode: 'wall' } }), true)
  assert.equal(entityUsesWallPlacement({ state: { placement: { mode: 'free' } } }, { geometry: {} }), false)
})

test('une nouvelle salle transfere ses cases et redessine le contour de la salle englobante', () => {
  const outer = {
    ...room('outer', 0),
    maxX: 3,
    maxZ: 3,
  }
  const surface = emptySurface({ rooms: { outer } })
  const result = applyRoomSelection(
    surface,
    { start: { x: 1, z: 1 }, end: { x: 2, z: 2 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )
  const nestedId = 'room:1:1:2:2:0:1'

  assert.equal(result.version, SURFACE_DATA_VERSION)
  assert.equal(getRoomFootprintCells(result.rooms.outer).length, 12)
  assert.equal(getRoomFootprintCells(result.rooms[nestedId]).length, 4)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, nestedId)
  assert.equal(findRoomAtCell(result, { x: 0, z: 0 }, 0).id, 'outer')
  assert.equal(roomFootprintRectangles(result.rooms.outer).length, 4)

  const expanded = expandRoomsToSurface(result)
  assert.equal(Object.keys(expanded.floors).length, 16)
  assert.equal(roomsWallSegments(result.rooms).filter(wall => wall.roomIds.length === 2).length, 8)
})

test('la création d’une salle retourne son identité pour passer immédiatement en sélection', () => {
  const surface = emptySurface()
  const result = applyRoomSelectionWithResult(
    surface,
    { start: { x: 3, z: 4 }, end: { x: 4, z: 5 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )

  assert.equal(result.roomId, 'room:3:4:4:5:0:1')
  const createdRoom = result.surfaceData.rooms[result.roomId]
  assert.ok(createdRoom)
  assert.equal(result.surfaceData.version, SURFACE_DATA_VERSION)
  assert.ok(createdRoom.floorMaterial)
  assert.ok(createdRoom.ceilingMaterial)
  assert.ok(createdRoom.wallInteriorMaterial)
  assert.equal(Object.prototype.hasOwnProperty.call(createdRoom, 'floorTopMaterial'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(createdRoom, 'ceilingBottomMaterial'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(createdRoom, 'wallExteriorMaterial'), false)
})

test('un arrondi de salle remplace une chaîne de murs dans le rendu de la salle', () => {
  const baseRoom = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const surface = emptySurface({ rooms: { rounded: baseRoom } })
  const selected = getRoomBoundaryWallRuns(baseRoom).filter(wall => ['west', 'north'].includes(wall.side))
  const result = applyRoomBoundaryArc(surface, 'rounded', selected.flatMap(wall => wall.edgeKeys), 90)

  assert.equal(result.error, null)
  assert.equal(result.surfaceData.version, SURFACE_DATA_VERSION)
  assert.equal(result.surfaceData.rooms.rounded.boundaryArcs.length, 1)
  assert.ok(roomsWallSegments(result.surfaceData.rooms).some(wall => wall.axis === 'segment'))
})

test('une porte existante empêche de courber son mur porteur', () => {
  const baseRoom = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(baseRoom).filter(wall => ['west', 'north'].includes(wall.side))
  const result = applyRoomBoundaryArc(emptySurface({
    rooms: { rounded: baseRoom },
    connectors: {
      door: { type: 'door', axis: 'x', x0: 0, x1: 4, z0: 0, z1: 0, y: 0 },
    },
  }), 'rounded', selected.flatMap(wall => wall.edgeKeys), 90)

  assert.match(result.error, /ouverture rigide/i)
})

test('une coupe qui separe une ancienne salle cree des composantes independantes', () => {
  const outer = { ...room('outer', 0), maxX: 2, maxZ: 2 }
  const result = applyRoomSelection(
    emptySurface({ rooms: { outer } }),
    { start: { x: 1, z: 0 }, end: { x: 1, z: 2 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )

  assert.equal(Object.keys(result.rooms).length, 3)
  assert.equal(findRoomAtCell(result, { x: 0, z: 1 }, 0).id, 'outer')
  assert.match(findRoomAtCell(result, { x: 2, z: 1 }, 0).id, /^outer:split:/)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, 'room:1:0:1:2:0:1')
  assert.equal(Object.values(result.rooms).flatMap(getRoomFootprintCells).length, 9)
})

test('deux salles superposees sur des etages distincts conservent chacune leurs cases', () => {
  const ground = { ...room('ground', 0), maxX: 2, maxZ: 2 }
  const result = applyRoomSelection(
    emptySurface({ rooms: { ground } }),
    { start: { x: 1, z: 1 }, end: { x: 1, z: 1 } },
    { level: 1, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )

  assert.equal(getRoomFootprintCells(result.rooms.ground).length, 9)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, 'ground')
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 1).id, 'room:1:1:1:1:1:1')
})

test('supprimer un mur exterieur ouvre la salle sans supprimer son sol', () => {
  const baseRoom = { ...room('roomA', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const north = getRoomBoundaryWallRuns(baseRoom).find(wall => wall.side === 'north')
  const before = roomsWallSegments({ roomA: baseRoom })
  const result = deleteRoomBoundaryWalls(
    emptySurface({ rooms: { roomA: baseRoom } }),
    'roomA',
    north.edgeKeys,
  )

  assert.equal(result.error, null)
  assert.deepEqual(result.surfaceData.rooms.roomA.openWallEdgeKeys.sort(), [...north.edgeKeys].sort())
  assert.equal(getRoomFootprintCells(result.surfaceData.rooms.roomA).length, 4)
  assert.equal(roomsWallSegments(result.surfaceData.rooms).length, before.length - north.edgeKeys.length)
})

test('supprimer un mur commun fusionne les deux salles et conserve la salle active', () => {
  const roomA = { ...room('roomA', 0), maxX: 0, maxZ: 0, cells: ['0:0'], floorTex: 101 }
  const roomB = { ...room('roomB', 0), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'], floorTex: 202 }
  const sharedWall = getRoomBoundaryWallRuns(roomA).find(wall => wall.side === 'east')
  const result = deleteRoomBoundaryWalls(emptySurface({
    rooms: { roomA, roomB },
    connectors: {
      door: { id: 'door', type: 'door', axis: 'z', x0: 4, x1: 4, z0: 0, z1: 4, y: 0 },
      ladder: { id: 'ladder', type: 'ladder', roomId: 'roomB', roomIds: ['roomB'], x: 1, z: 0 },
    },
  }), 'roomA', sharedWall.edgeKeys)

  assert.equal(result.error, null)
  assert.deepEqual(Object.keys(result.surfaceData.rooms), ['roomA'])
  assert.deepEqual(getRoomFootprintCells(result.surfaceData.rooms.roomA), [{ x: 0, z: 0 }, { x: 1, z: 0 }])
  assert.equal(result.surfaceData.rooms.roomA.floorTex, 101)
  assert.equal(result.surfaceData.connectors.door, undefined)
  assert.equal(result.surfaceData.connectors.ladder.roomId, 'roomA')
  assert.deepEqual(result.surfaceData.connectors.ladder.roomIds, ['roomA'])
  assert.equal(roomsWallSegments(result.surfaceData.rooms).length, 6)
})

test('supprimer une salle nettoie ses connecteurs et les références géométriques', () => {
  const source = emptySurface({
    rooms: {
      removed: room('removed', 0),
      survivor: {
        ...room('survivor', 0),
        minX: 2,
        maxX: 3,
        geometryClipRoomIds: ['removed'],
        boundaryArcs: [{ id: 'shared-arc', ownerRoomId: 'removed' }],
      },
    },
    connectors: {
      door: { id: 'door', type: 'door', roomId: 'removed', roomIds: ['removed', 'survivor'] },
      ladder: { id: 'ladder', type: 'ladder', roomIds: ['removed'] },
      free: { id: 'free', type: 'ladder', x: 10, z: 10 },
    },
  })
  const result = deleteSurfaceRoom(source, 'removed')

  assert.deepEqual(Object.keys(result.rooms), ['survivor'])
  assert.deepEqual(result.rooms.survivor.geometryClipRoomIds, [])
  assert.equal(result.rooms.survivor.boundaryArcs[0].ownerRoomId, 'survivor')
  assert.deepEqual(Object.keys(result.connectors), ['free'])
  assert.ok(source.rooms.removed)
})

test('fusionner des salles de hauteurs différentes conserve un profil vertical physique', () => {
  const roomA = { ...room('roomA', 0, 1), maxX: 0, maxZ: 0, cells: ['0:0'] }
  const roomB = { ...room('roomB', 0, 3), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'] }
  const sharedWall = getRoomBoundaryWallRuns(roomA).find(wall => wall.side === 'east')
  const result = deleteRoomBoundaryWalls(
    emptySurface({ rooms: { roomA, roomB } }),
    'roomA',
    sharedWall.edgeKeys,
  )

  assert.equal(result.error, null)
  assert.deepEqual(Object.keys(result.surfaceData.rooms), ['roomA'])
  const merged = result.surfaceData.rooms.roomA
  assert.equal(merged.heightLevels, 3)
  assert.equal(merged.verticalProfile.slices.length, 3)
  assert.deepEqual(
    merged.verticalProfile.slices.map(slice => multiPolygonGridCells(slice.footprint).length),
    [2, 1, 1],
  )

  const walls = roomsWallSegments(result.surfaceData.rooms)
  assert.equal(walls.filter(wall => wall.y === 0).length, 6)
  assert.equal(walls.filter(wall => wall.y === 2.5).length, 4)
  assert.equal(walls.filter(wall => wall.y === 5).length, 4)
  const expanded = expandRoomsToSurface(result.surfaceData)
  assert.ok(Object.keys(expanded.ceilings).some(key => key.endsWith(':0:2.5')))
  assert.ok(Object.keys(expanded.ceilings).some(key => key.endsWith(':0:7.5')))
})

test('une seconde fusion conserve une hauteur canonique sauvegardable', () => {
  const low = { ...room('low', 0, 1), maxX: 0, maxZ: 0, cells: ['0:0'] }
  const tall = { ...room('tall', 0, 3), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'] }
  const firstWall = getRoomBoundaryWallRuns(low).find(wall => wall.side === 'east')
  const first = deleteRoomBoundaryWalls(
    emptySurface({ rooms: { low, tall } }),
    'low',
    firstWall.edgeKeys,
  )
  const next = { ...room('next', 0, 1), minX: 2, maxX: 2, maxZ: 0, cells: ['2:0'] }
  const chainedSurface = {
    ...first.surfaceData,
    rooms: { ...first.surfaceData.rooms, next },
  }
  const secondWall = getRoomBoundaryWallRuns(next).find(wall => wall.side === 'west')
  const second = deleteRoomBoundaryWalls(chainedSurface, 'next', secondWall.edgeKeys)
  const merged = second.surfaceData.rooms.next

  assert.equal(second.error, null)
  assert.equal(merged.heightLevels, 3)
  assert.equal(merged.verticalProfile.slices.length, 3)
  assert.doesNotThrow(() => prepareSurfaceData(second.surfaceData, { battlemapId: 'chain-merge' }))
})

test('une nouvelle salle decoupe son volume sur la salle courbe deja presente', () => {
  const rounded = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const curved = applyRoomBoundaryArc(
    emptySurface({ rooms: { rounded } }),
    'rounded',
    selected,
    90,
  ).surfaceData
  const result = applyRoomSelection(
    curved,
    { start: { x: 0, z: 0 }, end: { x: 1, z: 1 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )
  const createdId = 'room:0:0:1:1:0:1'

  assert.deepEqual(result.rooms[createdId].geometryClipRoomIds, ['rounded'])
  assert.equal(roomGeometryIntersectionArea(
    { id: 'rounded', ...result.rooms.rounded },
    { id: createdId, ...result.rooms[createdId] },
    result.rooms,
  ), 0)
  assert.ok(roomsWallSegments(result.rooms).some(wall => wall.axis === 'segment' && wall.roomIds.length === 2))
})

test('supprimer une separation courbe fusionne les volumes sans conserver un arc fantome', () => {
  const rounded = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const curved = applyRoomBoundaryArc(
    emptySurface({ rooms: { rounded } }),
    'rounded',
    selected,
    90,
  ).surfaceData
  const split = applyRoomSelection(
    curved,
    { start: { x: 0, z: 0 }, end: { x: 1, z: 1 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )
  const merged = deleteRoomBoundaryWalls(split, 'rounded', selected)

  assert.equal(merged.error, null)
  assert.deepEqual(Object.keys(merged.surfaceData.rooms), ['rounded'])
  assert.deepEqual(merged.surfaceData.rooms.rounded.boundaryArcs, [])
  assert.equal(roomGeometryArea(
    { id: 'rounded', ...merged.surfaceData.rooms.rounded },
    merged.surfaceData.rooms,
  ), 4)
})

test('une porte sur un arc utilise le point, la tangente et la normale du mur canonique', () => {
  const rounded = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const surface = applyRoomBoundaryArc(
    emptySurface({ rooms: { rounded } }),
    'rounded',
    selected,
    90,
  ).surfaceData
  const curvePanel = roomsWallSegments(surface.rooms).find(wall => wall.curveId)
  const wallPoint = {
    fx: (Number(curvePanel.x0) + Number(curvePanel.x1)) / 2,
    fz: (Number(curvePanel.z0) + Number(curvePanel.z1)) / 2,
  }
  const door = makeDoorConnectorFromWallPoint(surface, wallPoint, {
    selectedRoomId: 'rounded',
    level: 0,
    connectorWallEdgeKeys: selected,
    connectorModelGeometry: { width: 0.8, depth: 0.2, height: 2 },
  })

  assert.equal(door.axis, 'segment')
  assert.equal(door.curveId, curvePanel.curveId)
  assert.ok(Number.isFinite(door.curveOffset))
  assert.ok(Math.abs(Math.hypot(door.tangentX, door.tangentZ) - 1) < 1e-6)
  assert.ok(Math.abs(Math.hypot(door.normalX, door.normalZ) - 1) < 1e-6)
  assert.ok(Math.abs(door.tangentX * door.normalX + door.tangentZ * door.normalZ) < 1e-6)
  assert.ok(Math.abs(Math.hypot(
    door.anchorX - Number(curvePanel.curveCenterX),
    door.anchorZ - Number(curvePanel.curveCenterZ),
  ) - Number(curvePanel.curveRadius)) < 1e-6)
  assert.equal(roomsWallRenderPaths(surface.rooms).filter(wall => wall.axis === 'arc').length, 1)

  const screenWindow = makeDoorConnectorFromWallPoint(surface, wallPoint, {
    selectedRoomId: 'rounded',
    level: 0,
    connectorType: 'screen-window',
    connectorWallEdgeKeys: selected,
    connectorModelGeometry: { width: 0.8, depth: 0.12, height: 1.5, openingBottom: 0.5 },
  })
  assert.equal(screenWindow.type, 'screen-window')
  assert.equal(screenWindow.y, 0.5)
  assert.deepEqual(screenWindow.allowedStates, ['transparent'])
  assert.equal(screenWindow.modelFacing, 'front')

  const configuredScreenWindow = makeDoorConnectorFromWallPoint(surface, wallPoint, {
    selectedRoomId: 'rounded',
    level: 0,
    connectorType: 'screen-window',
    connectorWallEdgeKeys: selected,
    connectorModelGeometry: {
      width: 0.8,
      depth: 0.12,
      height: 1.5,
      openingBottom: 0,
      allowedStates: ['transparent', 'opaque', 'mirror', 'unsupported'],
    },
  })
  assert.equal(configuredScreenWindow.y, 0)
  assert.deepEqual(configuredScreenWindow.allowedStates, ['transparent', 'opaque', 'mirror'])

  const catalogWindow = makeDoorConnectorFromWallPoint(surface, wallPoint, {
    level: 0,
    connectorType: 'window',
    connectorPlacementSource: 'object-palette',
    connectorModelGeometry: { width: 0.8, depth: 0.12, height: 1.5, openingBottom: 0.5 },
  })
  assert.equal(catalogWindow.type, 'window')
  assert.equal(catalogWindow.roomIds.includes('rounded'), true)

  const unrelatedWall = getRoomBoundaryWallRuns(rounded)
    .find(wall => wall.side === 'east')
  assert.equal(makeDoorConnectorFromWallPoint(surface, wallPoint, {
    selectedRoomId: 'rounded',
    level: 0,
    connectorWallEdgeKeys: unrelatedWall.edgeKeys,
    connectorModelGeometry: { width: 0.8, depth: 0.2, height: 2 },
  }), null)
})

test('un profil de mur multi étage est continu sur toute la hauteur', () => {
  const base = room('tower', 0, 2)
  const north = getRoomBoundaryWallRuns(base).find(wall => wall.side === 'north')
  const profiled = applyRoomWallElevationProfile(
    emptySurface({ rooms: { tower: base } }),
    'tower',
    north.edgeKeys,
    { type: 'curved', depth: 0.8, direction: 1 },
  ).surfaceData
  const walls = roomsWallSegments(profiled.rooms)
    .filter(wall => wall.elevationProfileMode)
    .sort((left, right) => left.y - right.y)

  assert.equal(new Set(walls.map(wall => wall.y)).size, 2)
  assert.ok(walls.every(wall => wall.elevationProfileOriginY === 0))
  assert.ok(walls.every(wall => wall.elevationProfileHeight === 5))
})

test('les tranches verticales d un mur partagent une façade de rendu unique', () => {
  const rendered = roomsWallRenderPaths({ tower: room('tower', 0, 3) })
  const byFacade = new Map()
  for (const wall of rendered) {
    assert.ok(wall.facadeId)
    assert.ok([-1, 1].includes(wall.interiorNormalSignsByRoom?.tower))
    if (!byFacade.has(wall.facadeId)) byFacade.set(wall.facadeId, [])
    byFacade.get(wall.facadeId).push(wall)
  }
  assert.equal(byFacade.size, 4)
  assert.ok([...byFacade.values()].every(walls => walls.length === 3))
})

test('une ouverture murale ne découpe que les tranches verticales réellement traversées', () => {
  const twoLevelWindow = { y: 1, height: 3, modelGeometry: { height: 3 } }
  assert.deepEqual(wallOpeningVerticalRange(twoLevelWindow, { y: 0, height: 2.5 }), {
    wallBottom: 0,
    wallTop: 2.5,
    bottom: 1,
    top: 2.5,
  })
  assert.deepEqual(wallOpeningVerticalRange(twoLevelWindow, { y: 2.5, height: 2.5 }), {
    wallBottom: 2.5,
    wallTop: 5,
    bottom: 2.5,
    top: 4,
  })
  assert.equal(wallOpeningVerticalRange(twoLevelWindow, { y: 5, height: 2.5 }), null)

  const door = { y: 0, height: 2 }
  assert.ok(wallOpeningVerticalRange(door, { y: 0, height: 2.5 }))
  assert.equal(wallOpeningVerticalRange(door, { y: 2.5, height: 2.5 }), null)
})

test('la gomme d étage supprime une fenêtre surélevée sans toucher un connecteur hors zone', () => {
  const surface = emptySurface({
    connectors: {
      window: {
        type: 'window', level: 0, y: 0.5, axis: 'x',
        x0: 0, x1: 4, z0: 0, z1: 0, width: 1, depth: 0.1,
      },
      remote: {
        type: 'screen-window', level: 0, y: 0.5, axis: 'x',
        x0: 20, x1: 24, z0: 20, z1: 20, width: 1, depth: 0.1,
      },
    },
  })
  const erased = eraseSurfaceSelection(
    surface,
    { start: { x: 0, z: 0 }, end: { x: 0, z: 0 } },
    { level: 0 },
  )

  assert.equal(erased.connectors.window, undefined)
  assert.ok(erased.connectors.remote)
})

test('une verrière exige une vraie interface horizontale et jamais un niveau vide d une salle haute', () => {
  const tallRoom = { ...room('well', 0, 2), cells: ['0:0'] }
  const surface = emptySurface({ rooms: { well: tallRoom } })
  const tool = {
    selectedRoomId: 'well',
    connectorType: 'skylight',
    connectorModelGeometry: { width: 1, depth: 1, height: 0.1 },
  }

  assert.ok(makeSkylightConnectorFromCell(surface, { x: 0, z: 0 }, { ...tool, level: 0 }))
  assert.equal(makeSkylightConnectorFromCell(surface, { x: 0, z: 0 }, { ...tool, level: 1 }), null)
  const ceilingSkylight = makeSkylightConnectorFromCell(surface, { x: 0, z: 0 }, { ...tool, level: 2 })
  assert.ok(ceilingSkylight)
  assert.equal(ceilingSkylight.y, 5)
  assert.deepEqual(ceilingSkylight.roomIds, ['well'])
})
