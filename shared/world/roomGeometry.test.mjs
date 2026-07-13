import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeRoomBoundaryArc,
  migrateRoomGeometryClips,
  roomBoundaryContours,
  roomBoundaryEdges,
  roomBoundaryPaths,
  roomBoundarySegments,
  roomBoundaryWallRuns,
  roomSelectableWallRuns,
  roomGeometryArea,
  roomGeometryContainsPoint,
  roomGeometryIntersectionArea,
  sampleRoomBoundaryArc,
  selectedRoomBoundaryChain,
  wallMiterOffsetVector,
  withWallMiterJoins,
} from './roomGeometry.js'

const square = {
  minX: 0,
  maxX: 1,
  minZ: 0,
  maxZ: 1,
  cells: ['0:0', '1:0', '0:1', '1:1'],
}

function pathProbe(path, side) {
  if (path.axis === 'arc') {
    const angle = path.startAngle + path.sweep / 2
    const direction = Math.sign(path.sweep)
    const tangent = {
      x: -Math.sin(angle) * direction,
      z: Math.cos(angle) * direction,
    }
    return {
      x: path.centerX + Math.cos(angle) * path.radius - tangent.z * side * 1e-3,
      z: path.centerZ + Math.sin(angle) * path.radius + tangent.x * side * 1e-3,
    }
  }
  const dx = path.x1 - path.x0
  const dz = path.z1 - path.z0
  const length = Math.hypot(dx, dz)
  return {
    x: (path.x0 + path.x1) / 2 - dz / length * side * 1e-3,
    z: (path.z0 + path.z1) / 2 + dx / length * side * 1e-3,
  }
}

test('les arêtes de contour sont stables et excluent les séparations internes', () => {
  const edges = roomBoundaryEdges(square)
  assert.equal(edges.length, 8)
  assert.equal(new Set(edges.map(edge => edge.key)).size, 8)
})

test('chaque chemin de mur expose une normale intérieure issue de la géométrie réelle', () => {
  const profiledRoom = { id: 'profiled', ...square }
  const paths = roomBoundaryPaths(profiledRoom)

  assert.ok(paths.length >= 4)
  for (const path of paths) {
    assert.ok([1, -1].includes(path.interiorNormalSign))
    assert.equal(roomGeometryContainsPoint(
      profiledRoom,
      pathProbe(path, path.interiorNormalSign),
    ), true)
    assert.equal(roomGeometryContainsPoint(
      profiledRoom,
      pathProbe(path, -path.interiorNormalSign),
    ), false)
  }
})

test('deux murs profilés adjacents partagent un raccord en onglet', () => {
  const walls = withWallMiterJoins([
    { id: 'north', axis: 'x', x0: 0, z0: 0, x1: 2, z1: 0, y: 0, height: 2.5 },
    { id: 'west', axis: 'z', x0: 0, z0: 2, x1: 0, z1: 0, y: 0, height: 2.5 },
  ], () => 'same-profile')
  const expected = wallMiterOffsetVector({ x: 0, z: 1 }, { x: 1, z: 0 })

  assert.deepEqual(walls[0].profileJoinStartMiter, expected)
  assert.deepEqual(walls[1].profileJoinEndMiter, expected)
  assert.ok(Math.abs(expected.x - 1) < 1e-6)
  assert.ok(Math.abs(expected.z - 1) < 1e-6)
})

test('une salle decoupee epouse exactement le mur courbe de la salle prioritaire', () => {
  const selectedKeys = roomBoundaryWallRuns(square)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const { arc } = makeRoomBoundaryArc(square, selectedKeys, 90)
  const rounded = { id: 'rounded', ...square, boundaryArcs: [arc] }
  const adjacent = { id: 'adjacent', ...square, geometryClipRoomIds: ['rounded'] }
  const rooms = { rounded, adjacent }

  assert.ok(roomGeometryArea(rounded, rooms) > 0)
  assert.ok(roomGeometryArea(adjacent, rooms) > 0)
  assert.ok(Math.abs(roomGeometryArea(rounded, rooms) + roomGeometryArea(adjacent, rooms) - 4) < 1e-5)
  assert.equal(roomGeometryIntersectionArea(rounded, adjacent, rooms), 0)

  const segmentKey = segment => {
    const start = `${segment.x0}:${segment.z0}`
    const end = `${segment.x1}:${segment.z1}`
    return start.localeCompare(end) <= 0 ? `${start}|${end}` : `${end}|${start}`
  }
  const roundedCurves = new Set(roomBoundarySegments(rounded, rooms)
    .filter(segment => segment.axis === 'segment')
    .map(segmentKey))
  const sharedCurves = roomBoundarySegments(adjacent, rooms)
    .filter(segment => segment.axis === 'segment' && roundedCurves.has(segmentKey(segment)))
  assert.ok(sharedCurves.length > 4)
})

test('la migration v6 donne la priorite a la premiere salle arrondie', () => {
  const selectedKeys = roomBoundaryWallRuns(square)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const { arc } = makeRoomBoundaryArc(square, selectedKeys, 90)
  const migrated = migrateRoomGeometryClips({
    rounded: { ...square, boundaryArcs: [arc] },
    adjacent: { ...square },
  })

  assert.deepEqual(migrated.adjacent.geometryClipRoomIds, ['rounded'])
})

test('ouvrir un mur exterieur retire tous ses segments physiques', () => {
  const northKeys = roomBoundaryWallRuns(square)
    .find(wall => wall.side === 'north')
    .edgeKeys
  const opened = { ...square, openWallEdgeKeys: northKeys }

  assert.equal(roomBoundarySegments(opened).length, roomBoundarySegments(square).length - northKeys.length)
})

test('les arêtes colinéaires sont regroupées en murs sélectionnables', () => {
  const walls = roomBoundaryWallRuns(square)

  assert.equal(walls.length, 4)
  assert.ok(walls.every(wall => wall.edgeKeys.length === 2))
})

test('deux murs adjacents deviennent un arc circulaire à 90 degrés', () => {
  const northWest = roomBoundaryWallRuns(square).filter(wall => ['west', 'north'].includes(wall.side))
  const result = makeRoomBoundaryArc(square, northWest.flatMap(wall => wall.edgeKeys), 90)

  assert.equal(result.error, undefined)
  assert.equal(result.arc.edgeKeys.length, 4)
  const points = sampleRoomBoundaryArc(result.arc)
  assert.deepEqual(points[0], result.arc.start)
  assert.deepEqual(points.at(-1), result.arc.end)
  assert.ok(points.length > 4)
  assert.ok(points.slice(1, -1).some(point => point.x > 0 && point.z > 0))
})

test('un arc canonique devient un seul mur sélectionnable à la place de ses anciens côtés', () => {
  const selected = roomBoundaryWallRuns(square).filter(wall => ['west', 'north'].includes(wall.side))
  const selectedKeys = selected.flatMap(wall => wall.edgeKeys)
  const { arc } = makeRoomBoundaryArc(square, selectedKeys, 90)
  const walls = roomSelectableWallRuns({ ...square, boundaryArcs: [arc] })
  const curvedWall = walls.find(wall => wall.axis === 'arc')

  assert.equal(walls.length, 3)
  assert.deepEqual(curvedWall.edgeKeys.sort(), selectedKeys.sort())
  assert.ok(curvedWall.points.length > 4)
})

test('un mur ouvert ne conserve pas de zone de sélection invisible', () => {
  const north = roomBoundaryWallRuns(square).find(wall => wall.side === 'north')
  const walls = roomSelectableWallRuns({ ...square, openWallEdgeKeys: north.edgeKeys })

  assert.equal(walls.length, 3)
  assert.equal(walls.some(wall => wall.side === 'north'), false)
})

test('une sélection disjointe est refusée', () => {
  const walls = roomBoundaryWallRuns(square)
  const selected = walls.filter(wall => ['north', 'south'].includes(wall.side)).flatMap(wall => wall.edgeKeys)
  assert.match(selectedRoomBoundaryChain(square, selected).error, /continue/)
})

test('le même arc remplace la chaîne dans le contour et dans les segments physiques', () => {
  const selected = roomBoundaryWallRuns(square).filter(wall => ['west', 'north'].includes(wall.side))
  const selectedKeys = selected.flatMap(wall => wall.edgeKeys)
  const selectedEdges = roomBoundaryEdges(square).filter(edge => selectedKeys.includes(edge.key))
  const { arc } = makeRoomBoundaryArc(square, selectedKeys, 90)
  const curved = { ...square, boundaryArcs: [arc] }
  const contours = roomBoundaryContours(curved)
  const segments = roomBoundarySegments(curved)

  assert.equal(contours.length, 1)
  assert.ok(contours[0].points.length > 8)
  assert.ok(segments.some(segment => segment.axis === 'segment'))
  assert.equal(segments.some(segment => selectedEdges.some(edge => (
    segment.x0 === edge.from.x && segment.z0 === edge.from.z
      && segment.x1 === edge.to.x && segment.z1 === edge.to.z
  ))), false)
})

test('un arrondi reste une primitive canonique unique malgré sa tessellation physique', () => {
  const selected = roomBoundaryWallRuns(square).filter(wall => ['west', 'north'].includes(wall.side))
  const { arc } = makeRoomBoundaryArc(square, selected.flatMap(wall => wall.edgeKeys), 90)
  const paths = roomBoundaryPaths({ id: 'rounded', ...square, boundaryArcs: [{ ...arc, ownerRoomId: 'rounded' }] })
  const curved = paths.filter(path => path.axis === 'arc')

  assert.equal(curved.length, 1)
  assert.equal(curved[0].curveId, `rounded:${arc.id}`)
  assert.ok(curved[0].radius > 0)
  assert.ok(Math.abs(curved[0].radius * curved[0].sweep) > 1)
  assert.ok(Math.abs(curved[0].curveLength - Math.abs(curved[0].radius * curved[0].sweep)) < 1e-5)
  assert.equal(roomGeometryContainsPoint(
    { id: 'rounded', ...square, boundaryArcs: [arc] },
    pathProbe(curved[0], curved[0].interiorNormalSign),
  ), true)
  assert.ok(roomBoundarySegments({ id: 'rounded', ...square, boundaryArcs: [arc] }).filter(segment => segment.curveId).length > 4)
})
