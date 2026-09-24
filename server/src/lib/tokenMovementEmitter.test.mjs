import test from 'node:test'
import assert from 'node:assert/strict'

import { WS } from '../../../shared/events.js'
import { buildTokenMovedPayload, emitExecutedTokenMovement } from './tokenMovementEmitter.js'

function fakeIo() {
  const emitted = []
  return {
    emitted,
    to(room) {
      return { emit: (event, data) => emitted.push({ room, event, data }) }
    },
  }
}

const TOKEN = { id: 't1', pos_x: 1, pos_y: 2, pos_z: 3, position_space: 'world-feet', updated_at: '2026-09-23T10:00:00Z', label: 'ignoré' }

test('buildTokenMovedPayload garde exactement les six champs lus par le client + le supplément', () => {
  assert.deepEqual(buildTokenMovedPayload(TOKEN, { kind: 'x' }), {
    tokenId: 't1', pos_x: 1, pos_y: 2, pos_z: 3, position_space: 'world-feet',
    updated_at: '2026-09-23T10:00:00Z', worldMovement: { kind: 'x' },
  })
})

test('déplacement effectif : runtime, puis passagers d’ascenseur, puis token déplacé (ordre historique)', () => {
  const io = fakeIo()
  const passenger = { ...TOKEN, id: 'p1' }
  emitExecutedTokenMovement(io, 'camp', {
    battlemapId: 'bm',
    outcome: { moved: true, token: TOKEN, runtimeRevision: 7, elevatorRuntime: { changed: false, runtimeRevision: 9 }, elevatorPassengerTokens: [passenger] },
    movedKind: 'combat-movement',
    worldMovement: { kind: 'combat-resolution' },
  })
  assert.deepEqual(io.emitted.map(e => [e.room, e.event]), [
    ['camp', WS.WORLD_RUNTIME_UPDATED],
    ['camp', WS.TOKEN_MOVED],
    ['camp', WS.TOKEN_MOVED],
  ])
  assert.deepEqual(io.emitted[0].data, { battlemapId: 'bm', runtimeRevision: 7, kind: 'combat-movement' })
  assert.equal(io.emitted[1].data.tokenId, 'p1')
  assert.deepEqual(io.emitted[1].data.worldMovement, { kind: 'elevator-passenger' })
  assert.equal(io.emitted[2].data.tokenId, 't1')
  assert.deepEqual(io.emitted[2].data.worldMovement, { kind: 'combat-resolution' })
})

test('sans déplacement mais horloge d’ascenseur changée : seul WORLD_RUNTIME_UPDATED elevator-clock (révision de l’ascenseur)', () => {
  const io = fakeIo()
  emitExecutedTokenMovement(io, 'camp', {
    battlemapId: 'bm',
    outcome: { moved: false, runtimeRevision: 0, elevatorRuntime: { changed: true, runtimeRevision: 9 }, elevatorPassengerTokens: [] },
    movedKind: 'combat-movement',
    worldMovement: null,
  })
  assert.equal(io.emitted.length, 1)
  assert.deepEqual(io.emitted[0].data, { battlemapId: 'bm', runtimeRevision: 9, kind: 'elevator-clock' })
})

test('rien à diffuser : aucun événement', () => {
  const io = fakeIo()
  emitExecutedTokenMovement(io, 'camp', { battlemapId: 'bm', outcome: null, movedKind: 'x', worldMovement: null })
  emitExecutedTokenMovement(io, 'camp', { battlemapId: 'bm', outcome: { moved: false, elevatorRuntime: { changed: false } }, movedKind: 'x', worldMovement: null })
  assert.equal(io.emitted.length, 0)
})

test('le kind du runtime est celui de l’appelant quand le token a bougé', () => {
  const io = fakeIo()
  emitExecutedTokenMovement(io, 'camp', {
    battlemapId: 'bm',
    outcome: { moved: true, token: TOKEN, runtimeRevision: 3, elevatorRuntime: { changed: false }, elevatorPassengerTokens: [] },
    movedKind: 'drone-interposition',
    worldMovement: { kind: 'drone-interposition' },
  })
  assert.equal(io.emitted[0].data.kind, 'drone-interposition')
})
