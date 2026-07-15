import test from 'node:test'
import assert from 'node:assert/strict'

import { cameraFacingFacadeIds, cameraRoomContextId, wallFacadeKey } from './cameraCutaway.js'
import { SURFACE_FINE, roomsWallRenderPaths } from './surfaceData.js'

function rectangularFacades() {
  const insideLeft = { tower: 1 }
  return [
    {
      id: 'front',
      surfaces: [{ interiorNormalSignsByRoom: insideLeft, path: [{ x: 0, z: 0 }, { x: 4, z: 0 }] }],
    },
    {
      id: 'right',
      surfaces: [{ interiorNormalSignsByRoom: insideLeft, path: [{ x: 4, z: 0 }, { x: 4, z: 4 }] }],
    },
    {
      id: 'back',
      surfaces: [{ interiorNormalSignsByRoom: insideLeft, path: [{ x: 4, z: 4 }, { x: 0, z: 4 }] }],
    },
    {
      id: 'left',
      surfaces: [{ interiorNormalSignsByRoom: insideLeft, path: [{ x: 0, z: 4 }, { x: 0, z: 0 }] }],
    },
  ]
}

const multiLevelRooms = {
  tower: {
    id: 'tower',
    minX: 0,
    maxX: 3,
    minZ: 0,
    maxZ: 3,
    y: 0,
    level: 0,
    heightLevels: 3,
  },
}

test('la position 3D de la camera active la salle meme si sa cible reste dehors', () => {
  const roomId = cameraRoomContextId({
    rooms: multiLevelRooms,
    displayLevel: 0,
    camera: { x: 1.5, y: 1.2, z: 1.5 },
    focus: { x: 8, y: 0, z: 8 },
  })
  assert.equal(roomId, 'tower')
})

test('la cible stable active la salle quand la camera reste a l exterieur', () => {
  const roomId = cameraRoomContextId({
    rooms: multiLevelRooms,
    displayLevel: 0,
    camera: { x: 1.5, y: 12, z: -8 },
    focus: { x: 1.5, y: 0, z: 1.5 },
  })
  assert.equal(roomId, 'tower')
})

test('la cible regardee garde le volume actif quand la camera traverse une salle voisine', () => {
  const roomId = cameraRoomContextId({
    rooms: {
      ...multiLevelRooms,
      neighbour: {
        id: 'neighbour',
        minX: 4,
        maxX: 7,
        minZ: 0,
        maxZ: 3,
        y: 0,
        level: 0,
        heightLevels: 3,
      },
    },
    displayLevel: 0,
    camera: { x: 5.5, y: 1.2, z: 1.5 },
    focus: { x: 1.5, y: 0, z: 1.5 },
  })
  assert.equal(roomId, 'tower')
})

test('une camera et une cible hors de la salle ne creent aucun contexte', () => {
  const roomId = cameraRoomContextId({
    rooms: multiLevelRooms,
    displayLevel: 0,
    camera: { x: 8, y: 1.2, z: 8 },
    focus: { x: 8, y: 0, z: 8 },
  })
  assert.equal(roomId, null)
})

test('une vue de face rend transparente la façade avant et garde le fond opaque', () => {
  const result = cameraFacingFacadeIds({
    camera: { x: 2, z: -6 },
    roomId: 'tower',
    facades: rectangularFacades(),
  })
  assert.deepEqual([...result], ['front'])
})

test('une rotation autour d une cible fixe classe les façades par leur normale intérieure', () => {
  const northWest = cameraFacingFacadeIds({
    camera: { x: -6, z: -6 },
    roomId: 'tower',
    facades: rectangularFacades(),
  })
  assert.deepEqual([...northWest].sort(), ['front', 'left'])

  const southEast = cameraFacingFacadeIds({
    camera: { x: 10, z: 10 },
    roomId: 'tower',
    facades: rectangularFacades(),
  })
  assert.deepEqual([...southEast].sort(), ['back', 'right'])
})

test('les étages et découpes d une façade partagent la même décision', () => {
  const facade = {
    id: 'front',
    surfaces: [
      { interiorNormalSignsByRoom: { tower: 1 }, path: [{ x: 0, z: 0 }, { x: 1.5, z: 0 }] },
      { interiorNormalSignsByRoom: { tower: 1 }, path: [{ x: 2.5, z: 0 }, { x: 4, z: 0 }] },
      { interiorNormalSignsByRoom: { tower: 1 }, path: [{ x: 0, z: 0 }, { x: 4, z: 0 }] },
    ],
  }
  const result = cameraFacingFacadeIds({
    camera: { x: 2, z: -6 },
    roomId: 'tower',
    facades: [facade],
  })
  assert.deepEqual([...result], ['front'])
  assert.equal(wallFacadeKey({ facadeId: 'front', logicalWallId: 'slice:0' }), 'front')
  assert.equal(wallFacadeKey({ facadeId: 'front', logicalWallId: 'slice:1' }), 'front')
})

test('une façade d une autre salle ne participe jamais à la coupe active', () => {
  const result = cameraFacingFacadeIds({
    camera: { x: 2, z: -6 },
    roomId: 'tower',
    facades: [{
      id: 'other',
      surfaces: [{ interiorNormalSignsByRoom: { other: 1 }, path: [{ x: 0, z: 0 }, { x: 4, z: 0 }] }],
    }],
  })
  assert.equal(result.size, 0)
})

test('les normales dérivées des vraies salles distinguent façade avant et mur du fond', () => {
  const walls = roomsWallRenderPaths({
    tower: {
      id: 'tower',
      minX: 0,
      maxX: 3,
      minZ: 0,
      maxZ: 3,
      y: 0,
      level: 0,
      heightLevels: 3,
      floorEnabled: true,
      wallEnabled: true,
      wallThickness: 1,
    },
  })
  const groups = new Map()
  for (const wall of walls) {
    if (!groups.has(wall.facadeId)) groups.set(wall.facadeId, { id: wall.facadeId, surfaces: [] })
    groups.get(wall.facadeId).surfaces.push({
      path: [
        { x: Number(wall.x0) / SURFACE_FINE, z: Number(wall.z0) / SURFACE_FINE },
        { x: Number(wall.x1) / SURFACE_FINE, z: Number(wall.z1) / SURFACE_FINE },
      ],
      interiorNormalSignsByRoom: wall.interiorNormalSignsByRoom,
    })
  }
  const front = walls.find(wall => Number(wall.z0) === 0 && Number(wall.z1) === 0)
  const back = walls.find(wall => Number(wall.z0) === 16 && Number(wall.z1) === 16)
  const result = cameraFacingFacadeIds({
    camera: { x: 2, z: -6 },
    roomId: 'tower',
    facades: [...groups.values()],
  })
  assert.equal(result.has(front.facadeId), true)
  assert.equal(result.has(back.facadeId), false)
  assert.equal(result.size, 1)
})
