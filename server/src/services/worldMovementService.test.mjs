import test from 'node:test'
import assert from 'node:assert/strict'

import { dynamicOccupantsFromRows, entityOccupant, resolvePlacementPoint } from './worldMovementService.js'

test('l’occupation dynamique serveur conserve les axes PE14 et les occupants multiples', () => {
  const occupants = dynamicOccupantsFromRows([
    { id: 'token-a', pos_x: 2, pos_y: 3, pos_z: 4, layer: 'token', position_space: 'world-feet' },
    { id: 'token-b', pos_x: 2, pos_y: 3, pos_z: 4, layer: 'token', position_space: 'world-feet' },
    { id: 'gm-marker', pos_x: 2, pos_y: 3, pos_z: 4, layer: 'gm', position_space: 'world-feet' },
  ], [])
  assert.deepEqual(occupants.map(item => item.id), ['token-a', 'token-b'])
  assert.deepEqual(occupants[0].point, { x: 2, y: 4, z: 3 })
})

test('une entité non bloquante est absente de l’occupation physique', () => {
  const occupants = dynamicOccupantsFromRows([], [
    {
      id: 'open-door', pos_x: 0, pos_y: 0, pos_z: 0, current_state_id: 0,
      states: [{ is_blocking: false }],
    },
    {
      id: 'crate', pos_x: 1, pos_y: 0, pos_z: 0, current_state_id: 0,
      states: [{ is_blocking: true, collider: { width: 2, depth: 1, height: 1 } }],
    },
  ])
  assert.deepEqual(occupants.map(item => item.id), ['crate'])
  // PLAN_FORME_COLLISION_ENTITES.md — défaut rect (pas de collider.shape configuré), plus le
  // rayon unique buggé (max(width,depth)/2 = 1) : halfWidth/halfDepth explicites.
  assert.equal(occupants[0].actorProfile.shape, 'rect')
  assert.equal(occupants[0].actorProfile.halfWidth, 1)
  assert.equal(occupants[0].actorProfile.halfDepth, 0.5)
})

test('la création d’un token se cale sur un support stable libre', () => {
  const graph = {
    actorProfile: { radius: 0.35, height: 1.8, maxStepHeight: 0.5 },
    nodes: [
      { id: 'traversal', kind: 'traversal', stable: true, point: { x: 0, y: 0, z: 0 } },
      { id: 'floor', kind: 'support', stable: true, point: { x: 0.5, y: 0.125, z: 0.5 } },
    ],
  }
  assert.deepEqual(
    resolvePlacementPoint({ graph, destination: { x: 0, y: 0, z: 0 } }),
    { x: 0.5, y: 0.125, z: 0.5 },
  )
  assert.equal(resolvePlacementPoint({
    graph,
    destination: { x: 0, y: 0, z: 0 },
    occupants: [{
      id: 'already-there',
      point: { x: 0.5, y: 0.125, z: 0.5 },
      actorProfile: graph.actorProfile,
    }],
  }), null)
})

test('l échelle d instance agrandit aussi son occupation physique', () => {
  const [occupant] = dynamicOccupantsFromRows([], [{
    id: 'scaled-crate', pos_x: 0, pos_y: 0, pos_z: 0, current_state_id: 0,
    state: { transform: { scale: 1.5 } },
    geometry: { width: 2, depth: 1, height: 2 },
    states: [{ is_blocking: true }],
  }])
  // PLAN_FORME_COLLISION_ENTITES.md — défaut rect : width=2×1.5=3 → halfWidth=1.5 ; depth=1×1.5=1.5
  // → halfDepth=0.75 (remplace l'ancienne assertion radius=1.5).
  assert.equal(occupant.actorProfile.shape, 'rect')
  assert.equal(occupant.actorProfile.halfWidth, 1.5)
  assert.equal(occupant.actorProfile.halfDepth, 0.75)
  assert.equal(occupant.actorProfile.height, 3)
})

test('une création administrative ne place pas un token non attaché dans une cabine mobile', () => {
  const graph = {
    actorProfile: { radius: 0.35, height: 1.8, maxStepHeight: 0.5 },
    nodes: [
      { id: 'cabin', kind: 'support', stable: true, mobile: true, point: { x: 0.5, y: 0.125, z: 0.5 } },
      { id: 'floor', kind: 'support', stable: true, point: { x: 1.5, y: 0.125, z: 0.5 } },
    ],
  }
  assert.deepEqual(
    resolvePlacementPoint({ graph, destination: { x: 0.55, y: 0.125, z: 0.5 } }),
    { x: 1.5, y: 0.125, z: 0.5 },
  )
})

// PLAN_FORME_COLLISION_ENTITES.md — collider.shape:'circle' explicite (ex. tonneau) : comportement
// historique préservé, radius calculé exactement comme avant ce plan.
test('collider.shape:\'circle\' explicite reste un cercle (rayon explicite ou replié sur max(w,d)/2)', () => {
  const [explicit] = dynamicOccupantsFromRows([], [{
    id: 'barrel', pos_x: 0, pos_y: 0, pos_z: 0, current_state_id: 0,
    states: [{ is_blocking: true, collider: { shape: 'circle', radius: 0.4, height: 1 } }],
  }])
  assert.equal(explicit.actorProfile.shape, 'circle')
  assert.equal(explicit.actorProfile.radius, 0.4)

  const [fallback] = dynamicOccupantsFromRows([], [{
    id: 'barrel-2', pos_x: 0, pos_y: 0, pos_z: 0, current_state_id: 0,
    states: [{ is_blocking: true, collider: { shape: 'circle', width: 0.8, depth: 0.8, height: 1 } }],
  }])
  assert.equal(fallback.actorProfile.shape, 'circle')
  assert.equal(fallback.actorProfile.radius, 0.4) // max(0.8,0.8)/2
})

// entity.r : 0-3, incréments de 90° — PAS la convention 0-7/45° des tokens (vérifié en analyse à
// charge contre EntityMesh.jsx/Editor3D.jsx/worldVisibilityService.js).
test('une entité rectangulaire tournée d’un quart de tour impair échange largeur et profondeur', () => {
  const unrotated = entityOccupant({
    id: 'crate', pos_x: 0, pos_y: 0, pos_z: 0, r: 0, current_state_id: 0,
    geometry: { width: 2, depth: 1 },
    states: [{ is_blocking: true }],
  })
  assert.equal(unrotated.actorProfile.halfWidth, 1)
  assert.equal(unrotated.actorProfile.halfDepth, 0.5)

  const rotated90 = entityOccupant({
    id: 'crate', pos_x: 0, pos_y: 0, pos_z: 0, r: 1, current_state_id: 0,
    geometry: { width: 2, depth: 1 },
    states: [{ is_blocking: true }],
  })
  assert.equal(rotated90.actorProfile.halfWidth, 0.5)
  assert.equal(rotated90.actorProfile.halfDepth, 1)

  const rotated180 = entityOccupant({
    id: 'crate', pos_x: 0, pos_y: 0, pos_z: 0, r: 2, current_state_id: 0,
    geometry: { width: 2, depth: 1 },
    states: [{ is_blocking: true }],
  })
  assert.equal(rotated180.actorProfile.halfWidth, 1) // tour pair — pas d'échange
  assert.equal(rotated180.actorProfile.halfDepth, 0.5)
})

// Convention d'origine : 'floor-center' (feet = centre réel) vs un coin par défaut (feet = coin
// min, centre décalé d'une demi-étendue) — même formule que worldVisibilityService.js, réutilisée.
test('le centre d’un rectangle d’entité tient compte de la convention d’origine du blueprint', () => {
  const centered = entityOccupant({
    id: 'crate', pos_x: 5, pos_y: 0, pos_z: 3, r: 0, current_state_id: 0,
    geometry: { width: 2, depth: 1, origin: 'floor-center' },
    states: [{ is_blocking: true }],
  })
  // dbPositionToWorldPoint : {x: pos_x, y: pos_z, z: pos_y} — feet = {x:5, y:3, z:0} (PE14).
  assert.deepEqual(centered.point, { x: 5, y: 3, z: 0 })

  const cornered = entityOccupant({
    id: 'crate', pos_x: 5, pos_y: 0, pos_z: 3, r: 0, current_state_id: 0,
    geometry: { width: 2, depth: 1 }, // pas de origin — coin par défaut
    states: [{ is_blocking: true }],
  })
  assert.deepEqual(cornered.point, { x: 6, y: 3, z: 0.5 }) // feet + halfWidth(1) en X, + halfDepth(0.5) en Z
})
