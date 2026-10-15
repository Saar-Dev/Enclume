import test from 'node:test'
import assert from 'node:assert/strict'

import { computeDecalPlacement, DEFAULT_DECAL_HEIGHT_M } from './computeDecalPlacement.js'
import { applyRoomBoundaryArc, getRoomBoundaryWallRuns, roomsWallSegments } from '../surfaceData.js'

function emptySurface(patch = {}) {
  return {
    version: 12, fine: 4, storyHeight: 2.5,
    rooms: {}, floors: {}, walls: {}, ceilings: {}, stairs: {}, connectors: {},
    ...patch,
  }
}
function room(id, level, patch = {}) {
  return {
    id, minX: 0, maxX: 1, minZ: 0, maxZ: 1, level, y: level * 2.5, heightLevels: 1,
    cells: ['0:0', '1:0', '0:1', '1:1'], wallThickness: 1,
    ...patch,
  }
}

const ASSET_ID = '11111111-1111-4111-8111-111111111111'

function northWallPoint(baseRoom, surface) {
  const north = getRoomBoundaryWallRuns(baseRoom).find(w => w.side === 'north')
  const panel = roomsWallSegments(surface.rooms).find(p => p.sourceEdgeKeys?.some(k => north.edgeKeys.includes(k)))
  return { fx: (Number(panel.x0) + Number(panel.x1)) / 2, fz: (Number(panel.z0) + Number(panel.z1)) / 2 }
}

test('computeDecalPlacement pose un décor avec la taille par défaut quand l’outil n’en précise pas', () => {
  const baseRoom = room('roomA', 0)
  const surface = emptySurface({ rooms: { roomA: baseRoom } })
  const wallPoint = northWallPoint(baseRoom, surface)

  const result = computeDecalPlacement(surface, wallPoint, { selectedRoomId: 'roomA', level: 0, decalAssetId: ASSET_ID })
  assert.equal(result.error, null)
  const posed = result.surfaceData.rooms.roomA.wallDecorations[0]
  assert.equal(posed.assetId, ASSET_ID)
  assert.equal(posed.widthM, DEFAULT_DECAL_HEIGHT_M)
  assert.equal(posed.heightM, DEFAULT_DECAL_HEIGHT_M)
  assert.equal(posed.mirror, false)
  assert.equal(posed.color, null)
})

test('computeDecalPlacement propage la teinte fournie par l’outil', () => {
  const baseRoom = room('roomA', 0)
  const surface = emptySurface({ rooms: { roomA: baseRoom } })
  const wallPoint = northWallPoint(baseRoom, surface)

  const result = computeDecalPlacement(surface, wallPoint, {
    selectedRoomId: 'roomA', level: 0, decalAssetId: ASSET_ID, decalColor: '#ff0000',
  })
  assert.equal(result.error, null)
  const posed = result.surfaceData.rooms.roomA.wallDecorations[0]
  assert.equal(posed.color, '#ff0000')
})

test('computeDecalPlacement respecte la largeur/hauteur/miroir fournis par l’outil', () => {
  const baseRoom = room('roomA', 0)
  const surface = emptySurface({ rooms: { roomA: baseRoom } })
  const wallPoint = northWallPoint(baseRoom, surface)

  const result = computeDecalPlacement(surface, wallPoint, {
    selectedRoomId: 'roomA', level: 0, decalAssetId: ASSET_ID, decalWidthM: 0.8, decalHeightM: 0.4, decalMirror: true,
  })
  assert.equal(result.error, null)
  const posed = result.surfaceData.rooms.roomA.wallDecorations[0]
  assert.equal(posed.widthM, 0.8)
  assert.equal(posed.heightM, 0.4)
  assert.equal(posed.mirror, true)
})

test('computeDecalPlacement refuse sans erreur fatale quand aucun mur n’est sous le curseur', () => {
  const baseRoom = room('roomA', 0)
  const surface = emptySurface({ rooms: { roomA: baseRoom } })
  // Point loin de tout mur réel (hors de la salle).
  const result = computeDecalPlacement(surface, { fx: 10000, fz: 10000 }, { selectedRoomId: 'roomA', level: 0, decalAssetId: ASSET_ID })
  assert.notEqual(result.error, null)
  assert.equal(result.surfaceData, surface)
})

test('computeDecalPlacement propage l’erreur de addRoomWallDecoration (asset manquant)', () => {
  const baseRoom = room('roomA', 0)
  const surface = emptySurface({ rooms: { roomA: baseRoom } })
  const wallPoint = northWallPoint(baseRoom, surface)

  const result = computeDecalPlacement(surface, wallPoint, { selectedRoomId: 'roomA', level: 0 })
  assert.notEqual(result.error, null)
  assert.equal(result.surfaceData, surface)
})

test('computeDecalPlacement pose aussi sur un mur courbe', () => {
  const rounded = room('rounded', 0)
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(w => ['west', 'north'].includes(w.side))
    .flatMap(w => w.edgeKeys)
  const surface = applyRoomBoundaryArc(emptySurface({ rooms: { rounded } }), 'rounded', selected, 90).surfaceData
  const curvePanel = roomsWallSegments(surface.rooms).find(wall => wall.curveId)
  const wallPoint = { fx: (Number(curvePanel.x0) + Number(curvePanel.x1)) / 2, fz: (Number(curvePanel.z0) + Number(curvePanel.z1)) / 2 }

  const result = computeDecalPlacement(surface, wallPoint, {
    selectedRoomId: 'rounded', level: 0, connectorWallEdgeKeys: selected, decalAssetId: ASSET_ID,
  })
  assert.equal(result.error, null, result.error)
  assert.equal(result.surfaceData.rooms.rounded.wallDecorations.length, 1)
})
