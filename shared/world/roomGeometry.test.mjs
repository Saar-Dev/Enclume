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
  roomGeometryArea,
  roomGeometryIntersectionArea,
  sampleRoomBoundaryArc,
  selectedRoomBoundaryChain,
} from './roomGeometry.js'

const square = {
  minX: 0,
  maxX: 1,
  minZ: 0,
  maxZ: 1,
  cells: ['0:0', '1:0', '0:1', '1:1'],
}

test('les arêtes de contour sont stables et excluent les séparations internes', () => {
  const edges = roomBoundaryEdges(square)
  assert.equal(edges.length, 8)
  assert.equal(new Set(edges.map(edge => edge.key)).size, 8)
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
  assert.ok(roomBoundarySegments({ id: 'rounded', ...square, boundaryArcs: [arc] }).filter(segment => segment.curveId).length > 4)
})
