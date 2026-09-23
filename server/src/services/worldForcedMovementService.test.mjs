import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from '../../../shared/world/worldContracts.js'
import { resolveRigidPairSteps } from './worldForcedMovementService.js'

const points = [-0.5, 0.5, 1.5, 2.5]
const supports = points.map((x, index) => ({
  id: `support:${index}`,
  kind: 'floor',
  bounds: { min: { x: x - 0.5, y: -0.1, z: 0 }, max: { x: x + 0.5, y: 0, z: 1 } },
  y: 0,
  walkable: true,
}))
const snapshot = createWorldSnapshot({
  battlemapId: 'battlemap',
  worldRevision: 1,
  metrics: { metersPerCell: 1.5, worldUnitsPerCell: 1, storyHeightWorld: 2.5 },
  spatial: { supports, colliders: [], occluders: [], traversals: [], regions: [], compartments: [] },
})
const graph = {
  nodes: points.map((x, index) => ({ id: `node:${index}`, kind: 'support', stable: true, point: { x, y: 0, z: 0.5 } })),
}

// entityProfile explicite (pas le défaut null) — PLAN_FORME_COLLISION_ENTITES.md : null signifie
// désormais « entité actuellement non bloquante, aucun test pour elle-même », un cas distinct de
// celui testé ici (entité réellement poussée, doit être testée comme n'importe quel occupant).
const genericEntityProfile = { radius: 0.35, height: 1.8, maxStepHeight: 0.5 }

test('deplace le token et l objet comme une paire rigide sur les supports du monde', () => {
  const result = resolveRigidPairSteps({
    snapshot,
    graph,
    actorStart: { x: -0.5, y: 0, z: 0.5 },
    entityStart: { x: 0.5, y: 0, z: 0.5 },
    entityProfile: genericEntityProfile,
    destination: { x: 2.5, y: 0, z: 0.5 },
    maxSteps: 2,
    occupants: [],
    excludeOccupantIds: ['actor', 'entity'],
  })
  assert.equal(result.status, 'destination')
  assert.equal(result.stepsCompleted, 2)
  assert.deepEqual(result.actorEnd, { x: 1.5, y: 0, z: 0.5 })
  assert.deepEqual(result.entityEnd, { x: 2.5, y: 0, z: 0.5 })
})

test('s arrete au dernier support libre sans traverser un occupant', () => {
  const result = resolveRigidPairSteps({
    snapshot,
    graph,
    actorStart: { x: -0.5, y: 0, z: 0.5 },
    entityStart: { x: 0.5, y: 0, z: 0.5 },
    entityProfile: genericEntityProfile,
    destination: { x: 2.5, y: 0, z: 0.5 },
    maxSteps: 2,
    occupants: [{ id: 'blocker', point: { x: 2.5, y: 0, z: 0.5 }, actorProfile: {} }],
    excludeOccupantIds: ['actor', 'entity'],
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.stepsCompleted, 1)
  assert.deepEqual(result.entityEnd, { x: 1.5, y: 0, z: 0.5 })
})

// PLAN_FORME_COLLISION_ENTITES.md point 4.3 — entityProfile: null (entité actuellement non
// bloquante, ex. porte ouverte) : aucun test de dégagement/occupation pour elle-même, seul
// l'acteur (le pousseur) reste contraint. Sans ce comportement, un même occupant au point
// d'arrivée bloquerait quand même la paire alors que l'entité elle-même ne peut rien percuter.
test('entityProfile: null (entité non bloquante) ignore le test de dégagement/occupation pour elle-même', () => {
  const result = resolveRigidPairSteps({
    snapshot,
    graph,
    actorStart: { x: -0.5, y: 0, z: 0.5 },
    entityStart: { x: 0.5, y: 0, z: 0.5 },
    entityProfile: null,
    destination: { x: 2.5, y: 0, z: 0.5 },
    maxSteps: 2,
    occupants: [{ id: 'blocker', point: { x: 2.5, y: 0, z: 0.5 }, actorProfile: {} }],
    excludeOccupantIds: ['actor', 'entity'],
  })
  assert.equal(result.status, 'destination')
  assert.equal(result.stepsCompleted, 2)
  // L'entité atteint bien la position de 'blocker' (2.5) — aucun test d'occupation pour elle-même
  // (entityProfile: null), seul l'acteur restait contraint (et n'était pas au même point).
  assert.deepEqual(result.entityEnd, { x: 2.5, y: 0, z: 0.5 })
})
