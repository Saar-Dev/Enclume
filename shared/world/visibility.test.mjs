import test from 'node:test'
import assert from 'node:assert/strict'

import {
  checkWorldCoverage,
  checkWorldLineOfSight,
  findWorldInterceptors,
  traceVisibility,
} from './visibility.js'
import { createWorldSnapshot } from './worldContracts.js'

function snapshot(occluders = []) {
  return createWorldSnapshot({
    battlemapId: '00000000-0000-4000-8000-000000000001',
    worldRevision: 1,
    metrics: { schemaVersion: 1, metersPerCell: 1.5, worldUnitsPerCell: 1, storyHeightWorld: 3 },
    spatial: { supports: [], barriers: [], traversals: [], colliders: [], occluders, compartments: [], regions: [] },
  })
}

const wall = {
  id: 'wall', kind: 'wall', opacity: 1,
  bounds: { min: { x: 1.9, y: 0, z: -1 }, max: { x: 2.1, y: 3, z: 1 } },
}

test('un mur plein bloque une LOS 3D et expose le bloqueur', () => {
  const result = checkWorldLineOfSight({
    snapshot: snapshot([wall]),
    sourceFeet: { x: 0, y: 0, z: 0 },
    targetFeet: { x: 4, y: 0, z: 0 },
  })
  assert.equal(result.clear, false)
  assert.equal(result.blockers[0].id, 'wall')
  assert.equal(result.distanceM, 6)
})

test('verre et grille sans occluder laissent la vue tout en restant des colliders possibles', () => {
  const result = checkWorldLineOfSight({
    snapshot: snapshot([]),
    sourceFeet: { x: 0, y: 0, z: 0 },
    targetFeet: { x: 4, y: 0, z: 0 },
  })
  assert.equal(result.clear, true)
  assert.equal(result.transmittance, 1)
})

test('la LOS respecte le prisme orienté d’un mur courbe', () => {
  const diagonal = {
    id: 'diagonal', kind: 'wall', opacity: 1,
    bounds: { min: { x: -0.05, y: 0, z: -0.05 }, max: { x: 1.05, y: 2.5, z: 1.05 } },
    geometry: {
      type: 'wall-segment',
      from: { x: 0, z: 0 },
      to: { x: 1, z: 1 },
      minY: 0,
      maxY: 2.5,
      thickness: 0.1,
    },
  }

  assert.equal(traceVisibility({
    snapshot: snapshot([diagonal]),
    from: { x: 0.1, y: 1, z: 0.9 },
    to: { x: 0.2, y: 1, z: 0.9 },
  }).clear, true)
  assert.equal(traceVisibility({
    snapshot: snapshot([diagonal]),
    from: { x: 0, y: 1, z: 1 },
    to: { x: 1, y: 1, z: 0 },
  }).clear, false)
})

test('la LOS consomme directement une primitive mur-arc canonique', () => {
  const arc = {
    id: 'arc', kind: 'wall', opacity: 1,
    bounds: { min: { x: -0.05, y: 0, z: -0.05 }, max: { x: 1.05, y: 2.5, z: 1.05 } },
    geometry: {
      type: 'wall-arc',
      center: { x: 0, z: 0 },
      radius: 1,
      startAngle: 0,
      sweep: Math.PI / 2,
      minY: 0,
      maxY: 2.5,
      thickness: 0.1,
    },
  }

  assert.equal(traceVisibility({
    snapshot: snapshot([arc]),
    from: { x: 0.1, y: 1, z: 0.5 },
    to: { x: 0.3, y: 1, z: 0.5 },
  }).clear, true)
  assert.equal(traceVisibility({
    snapshot: snapshot([arc]),
    from: { x: 0.1, y: 1, z: 0.5 },
    to: { x: 1.2, y: 1, z: 0.5 },
  }).clear, false)
})

test('des volumes atténuants dynamiques se cumulent de façon déterministe', () => {
  const smoke = index => ({
    id: `smoke-${index}`, kind: 'smoke', opacity: 0.8,
    bounds: { min: { x: index, y: 0, z: -1 }, max: { x: index + 0.5, y: 3, z: 1 } },
  })
  const result = traceVisibility({
    snapshot: snapshot(),
    from: { x: 0, y: 1, z: 0 },
    to: { x: 4, y: 1, z: 0 },
    dynamicOccluders: [smoke(1), smoke(2)],
  })
  assert.equal(result.clear, false)
  assert.equal(result.transmittance, 0.04)
  assert.deepEqual(result.blockers.map(item => item.id), ['smoke-1', 'smoke-2'])
})

test('la couverture échantillonne la posture cible au lieu d’un rayon unique', () => {
  const lowWall = {
    id: 'low-wall', kind: 'wall', opacity: 1,
    bounds: { min: { x: 1.9, y: 0, z: -1 }, max: { x: 2.1, y: 1.3, z: 1 } },
  }
  const result = checkWorldCoverage({
    snapshot: snapshot([lowWall]),
    sourceFeet: { x: 0, y: 0, z: 0 },
    targetFeet: { x: 4, y: 0, z: 0 },
  })
  assert.equal(result.blocked, 2)
  assert.equal(result.total, 4)
  assert.equal(result.modifier, -3)
})

test('les tokens interposés sont triés en mètres depuis le tireur', () => {
  const hits = findWorldInterceptors({
    snapshot: snapshot(),
    from: { x: 0, y: 1, z: 0 },
    to: { x: 5, y: 1, z: 0 },
    actors: [
      { id: 'far', point: { x: 4, y: 0, z: 0 } },
      { id: 'near', point: { x: 2, y: 0, z: 0 } },
      { id: 'aside', point: { x: 3, y: 0, z: 2 } },
    ],
  })
  assert.deepEqual(hits.map(hit => hit.actorId), ['near', 'far'])
  assert.equal(hits[0].distanceM, 3)
})
