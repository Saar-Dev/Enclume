import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from '../../../shared/world/worldContracts.js'
import {
  dynamicOccludersFromEntities,
  evaluateWorldVisibility,
} from './worldVisibilityService.js'

const world = createWorldSnapshot({
  worldRevision: 4,
  spatial: { supports: [], barriers: [], traversals: [], colliders: [], occluders: [], compartments: [], regions: [] },
})

const source = { id: 'source', pos_x: 0, pos_y: 0, pos_z: 0, position_space: 'world-feet' }
const target = { id: 'target', pos_x: 4, pos_y: 0, pos_z: 0, position_space: 'world-feet' }

test('les dimensions et la rotation d’une entité alimentent son occluder dynamique', () => {
  const [occluder] = dynamicOccludersFromEntities([{
    id: 'crate', pos_x: 2, pos_y: 0, pos_z: 0, r: 1, current_state_id: 0,
    geometry: { width: 2, depth: 1, height: 1.5, origin: 'floor-center' },
    states: [{ is_blocking: true }],
  }])
  assert.deepEqual(occluder.bounds, {
    min: { x: 1.5, y: 0, z: -1 },
    max: { x: 2.5, y: 1.5, z: 1 },
  })
})

test('le service de monde combine occlusion, couverture et interposition', () => {
  const result = evaluateWorldVisibility({
    snapshot: world,
    sourceToken: source,
    targetToken: target,
    tokens: [source, target, { id: 'middle', pos_x: 2, pos_y: 0, pos_z: 0, position_space: 'world-feet' }],
    entities: [],
  })
  assert.equal(result.status, 'clear')
  assert.equal(result.coverage.modifier, 0)
  assert.deepEqual(result.interceptors.map(item => item.actorId), ['middle'])
})

test('une position legacy est refusée au lieu de recevoir un décalage approximatif', () => {
  const result = evaluateWorldVisibility({
    snapshot: world,
    sourceToken: { ...source, position_space: 'legacy-cell' },
    targetToken: target,
  })
  assert.equal(result.status, 'legacy-position')
  assert.equal(result.line, null)
})
