import test from 'node:test'
import assert from 'node:assert/strict'

import {
  persistSurfaceDocument,
  sameSurfaceDocument,
  SurfaceRevisionConflictError,
} from './surfacePersistence.js'

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return payload },
  }
}

const square = {
  version: 8,
  fine: 4,
  storyHeight: 2.5,
  rooms: { room: { minX: 0, maxX: 1, minZ: 0, maxZ: 1, cells: ['0:0', '1:0', '0:1', '1:1'] } },
  floors: {}, walls: {}, ceilings: {}, stairs: {}, connectors: {},
}

const rounded = {
  ...square,
  rooms: {
    room: {
      ...square.rooms.room,
      boundaryArcs: [{
        id: 'arc:north-east',
        edgeKeys: ['x:0:0:1:0', 'z:1:0:1:1'],
        start: { x: 0, z: 0 },
        end: { x: 1, z: 1 },
        angleDegrees: 90,
        side: 1,
      }],
    },
  },
}

test('une sauvegarde Surface directe conserve les arcs et les révisions retournées', async () => {
  const calls = []
  const result = await persistSurfaceDocument({
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return response(200, { surface_data: rounded, surface_revision: 2, world_revision: 4 })
    },
    battlemapId: 'map',
    surfaceData: rounded,
    expectedRevision: 1,
    baseSurfaceData: square,
  })

  assert.equal(calls.length, 1)
  assert.equal(JSON.parse(calls[0].options.body).surface_revision, 1)
  assert.equal(result.data.surface_data.rooms.room.boundaryArcs.length, 1)
  assert.equal(result.data.surface_revision, 2)
})

test('une révision locale obsolète est rebasée si le document serveur est encore la base connue', async () => {
  const calls = []
  const queued = [
    response(409, { error: { message: 'revision conflict' } }),
    response(200, { battlemap: { id: 'map', surface_data: square, surface_revision: 1, world_revision: 1 } }),
    response(200, { surface_data: rounded, surface_revision: 2, world_revision: 2 }),
  ]
  const result = await persistSurfaceDocument({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      return queued.shift()
    },
    battlemapId: 'map',
    surfaceData: rounded,
    expectedRevision: 0,
    baseSurfaceData: square,
  })

  assert.equal(calls.length, 3)
  assert.equal(calls[1].options.method, undefined)
  assert.equal(JSON.parse(calls[2].options.body).surface_revision, 1)
  assert.equal(JSON.parse(calls[2].options.body).surface_data.rooms.room.boundaryArcs.length, 1)
  assert.equal(result.data.surface_revision, 2)
})

test('une vraie modification concurrente n’est jamais écrasée par le rebasage automatique', async () => {
  const concurrent = { ...square, rooms: { ...square.rooms, other: { minX: 5, maxX: 5, minZ: 5, maxZ: 5 } } }
  const queued = [
    response(409, { error: { message: 'revision conflict' } }),
    response(200, { battlemap: { id: 'map', surface_data: concurrent, surface_revision: 3, world_revision: 3 } }),
  ]
  await assert.rejects(
    persistSurfaceDocument({
      fetchImpl: async () => queued.shift(),
      battlemapId: 'map',
      surfaceData: rounded,
      expectedRevision: 1,
      baseSurfaceData: square,
    }),
    SurfaceRevisionConflictError,
  )
  assert.equal(sameSurfaceDocument(square, concurrent), false)
})

test('l’ordre des clés JSONB ne crée pas un faux conflit', () => {
  const reordered = {
    connectors: {}, stairs: {}, ceilings: {}, walls: {}, floors: {},
    rooms: square.rooms, storyHeight: 2.5, fine: 4, version: 8,
  }
  assert.equal(sameSurfaceDocument(square, reordered), true)
})

test('une sauvegarde redérive la hauteur depuis les tranches avant le PUT', async () => {
  const calls = []
  const footprint = [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]
  const staleHeight = {
    ...square,
    version: 10,
    rooms: {
      room: {
        ...square.rooms.room,
        heightLevels: 1,
        height: 2.5,
        verticalProfile: {
          slices: [0, 1, 2].map(offset => ({ offset, footprint, wallPaths: [] })),
        },
      },
    },
  }
  await persistSurfaceDocument({
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      const sent = JSON.parse(options.body).surface_data
      return response(200, { surface_data: sent, surface_revision: 2, world_revision: 4 })
    },
    battlemapId: 'map',
    surfaceData: staleHeight,
    expectedRevision: 1,
    baseSurfaceData: square,
  })

  const sentRoom = JSON.parse(calls[0].options.body).surface_data.rooms.room
  assert.equal(sentRoom.heightLevels, 3)
  assert.equal(sentRoom.height, 7.5)
  assert.equal(sentRoom.verticalProfile.slices.length, 3)
})
