import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cacheBattlemapWorldSnapshot,
  getBattlemapStructuralSnapshotWithRuntimeState,
  getBattlemapWorldSnapshot,
  invalidateBattlemapStructuralRuntimeSnapshot,
  invalidateBattlemapWorld,
} from './worldService.js'

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

function battlemap(id, worldRevision, runtimeRevision = 0) {
  return {
    id,
    world_revision: worldRevision,
    runtime_revision: runtimeRevision,
    surface_data: emptySurface(),
  }
}

// DEPLACEMENT1 (docs/BUGIDENTIFIE.md) — loadBattlemapRuntimeContext recompilait le monde entier à
// chaque appel (dont chaque case survolée pendant une prévisualisation de déplacement). Ces tests
// verrouillent le comportement de cache attendu : même révision → même instance (aucune
// recompilation), révision différente → nouvelle instance.

test('getBattlemapWorldSnapshot ne recompile pas pour une révision inchangée', () => {
  const map = battlemap('map-cache-1', 5)
  const first = getBattlemapWorldSnapshot(map)
  const second = getBattlemapWorldSnapshot(map)
  assert.equal(first, second, 'même world_revision → même instance mise en cache')
})

test('getBattlemapWorldSnapshot recompile quand world_revision change', () => {
  const first = getBattlemapWorldSnapshot(battlemap('map-cache-2', 1))
  const second = getBattlemapWorldSnapshot(battlemap('map-cache-2', 2))
  assert.notEqual(first, second, 'world_revision différente → recompilation')
})

test('invalidateBattlemapWorld force une recompilation même à révision identique', () => {
  const map = battlemap('map-cache-3', 7)
  const first = getBattlemapWorldSnapshot(map)
  invalidateBattlemapWorld(map.id)
  const second = getBattlemapWorldSnapshot(map)
  assert.notEqual(first, second)
})

test('cacheBattlemapWorldSnapshot réchauffe le cache sans recompilation ultérieure', () => {
  const map = battlemap('map-cache-4', 3)
  const precompiled = getBattlemapWorldSnapshot(battlemap('other-map', 3))
  cacheBattlemapWorldSnapshot(map, precompiled)
  assert.equal(getBattlemapWorldSnapshot(map), precompiled)
})

test('getBattlemapStructuralSnapshotWithRuntimeState ne recompile pas pour (world_revision, runtime_revision) inchangés', () => {
  const map = battlemap('map-runtime-1', 1, 4)
  const runtimeState = { featureStates: {} }
  const first = getBattlemapStructuralSnapshotWithRuntimeState(map, runtimeState)
  const second = getBattlemapStructuralSnapshotWithRuntimeState(map, runtimeState)
  assert.equal(first, second, 'même (world_revision, runtime_revision) → aucune recompilation')
})

test('getBattlemapStructuralSnapshotWithRuntimeState recompile quand runtime_revision change seul', () => {
  const runtimeState = { featureStates: {} }
  const first = getBattlemapStructuralSnapshotWithRuntimeState(battlemap('map-runtime-2', 1, 1), runtimeState)
  const second = getBattlemapStructuralSnapshotWithRuntimeState(battlemap('map-runtime-2', 1, 2), runtimeState)
  assert.notEqual(first, second, 'runtime_revision différente (ex. porte ouverte/fermée) → recompilation')
})

test('getBattlemapStructuralSnapshotWithRuntimeState et getBattlemapWorldSnapshot utilisent des caches indépendants', () => {
  const map = battlemap('map-runtime-3', 9, 9)
  const structural = getBattlemapWorldSnapshot(map)
  const withRuntimeState = getBattlemapStructuralSnapshotWithRuntimeState(map, { featureStates: {} })
  assert.notEqual(
    structural,
    withRuntimeState,
    'le cache sans état runtime ne doit jamais être confondu avec celui qui en tient compte',
  )
})

test('invalidateBattlemapStructuralRuntimeSnapshot force une recompilation à révisions identiques', () => {
  const map = battlemap('map-runtime-4', 2, 2)
  const runtimeState = { featureStates: {} }
  const first = getBattlemapStructuralSnapshotWithRuntimeState(map, runtimeState)
  invalidateBattlemapStructuralRuntimeSnapshot(map.id)
  const second = getBattlemapStructuralSnapshotWithRuntimeState(map, runtimeState)
  assert.notEqual(first, second)
})
