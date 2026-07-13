import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createWorldDocument,
  createWorldRuntimeState,
  createWorldSnapshot,
  validateWorldDocument,
  WorldContractError,
} from './worldContracts.js'

const FEATURE_ID = '11111111-1111-4111-8111-111111111111'
const EFFECT_ID = '22222222-2222-4222-8222-222222222222'

test('le document monde vide est versionné, strict et immuable', () => {
  const document = createWorldDocument({ battlemapId: 'battlemap-test' })
  assert.equal(document.schema, 'enclume.world-document')
  assert.equal(document.version, 1)
  assert.equal(validateWorldDocument(document).valid, true)
  assert.equal(Object.isFrozen(document.features.rooms), true)
  assert.throws(() => { document.features.rooms[FEATURE_ID] = {} }, TypeError)
})

test('les features du document exigent une identité UUID stable et cohérente', () => {
  assert.throws(() => createWorldDocument({
    features: { rooms: { 'room:0:0': { id: 'room:0:0' } } },
  }), WorldContractError)
  assert.throws(() => createWorldDocument({
    features: { rooms: { [FEATURE_ID]: { id: EFFECT_ID } } },
  }), /doit correspondre à sa clé/)
  assert.throws(() => createWorldDocument({
    features: { stairs: {} },
  }), /collection inconnue/)
})

test('l’état runtime est séparé du document statique et possède sa révision', () => {
  const runtime = createWorldRuntimeState({
    battlemapId: 'battlemap-test',
    worldRevision: 12,
    featureStates: { [FEATURE_ID]: { id: FEATURE_ID, state: 'open' } },
    effectInstances: { [EFFECT_ID]: { id: EFFECT_ID, code: 'fire' } },
  })
  assert.equal(runtime.worldRevision, 12)
  assert.equal(runtime.featureStates[FEATURE_ID].state, 'open')
  assert.equal(runtime.effectInstances[EFFECT_ID].code, 'fire')
  assert.equal(Object.isFrozen(runtime.effectInstances[EFFECT_ID]), true)
})

test('le snapshot refuse les identifiants compilés dupliqués', () => {
  assert.throws(() => createWorldSnapshot({
    battlemapId: 'battlemap-test',
    spatial: { supports: [{ id: 'support-1' }, { id: 'support-1' }] },
  }), /contient deux fois/)
  assert.throws(() => createWorldSnapshot({
    battlemapId: 'battlemap-test',
    spatial: { meshes: [] },
  }), /collection inconnue/)
})

test('le snapshot valide est profondément immuable', () => {
  const snapshot = createWorldSnapshot({
    battlemapId: 'battlemap-test',
    worldRevision: 3,
    spatial: {
      supports: [{ id: 'support-1', walkable: true }],
      barriers: [{ id: 'barrier-1', channels: { movement: true, sight: false } }],
    },
  })
  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.spatial.barriers[0].channels), true)
  assert.throws(() => { snapshot.spatial.supports[0].walkable = false }, TypeError)
})
