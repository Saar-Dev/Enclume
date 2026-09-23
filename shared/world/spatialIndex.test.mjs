import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from './worldContracts.js'
import {
  actorBoundsAt,
  actorFootprintsOverlap,
  createOccupancyIndex,
  createSpatialIndex,
  normalizeActorProfile,
  segmentGeometryInterval,
} from './spatialIndex.js'

function snapshotWithWall() {
  const wallBounds = {
    min: { x: 1.9, y: 0, z: 0 },
    max: { x: 2.1, y: 2.5, z: 1 },
  }
  return createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{ id: 'wall', sourceId: 'wall', kind: 'wall', bounds: wallBounds }],
    },
  })
}

test('l’index statique détecte un mur sans traiter le sol touché comme un obstacle', () => {
  const snapshot = snapshotWithWall()
  const index = createSpatialIndex(snapshot)
  assert.equal(index.isSegmentClear(
    { x: 0.5, y: 0.125, z: 0.5 },
    { x: 2.5, y: 0.125, z: 0.5 },
  ), false)

  const floorSnapshot = createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{
        id: 'floor', sourceId: 'floor', kind: 'floor',
        bounds: { min: { x: 0, y: -0.125, z: 0 }, max: { x: 2, y: 0.125, z: 1 } },
      }],
    },
  })
  assert.equal(createSpatialIndex(floorSnapshot).isSegmentClear(
    { x: 0.5, y: 0.125, z: 0.5 },
    { x: 1.5, y: 0.125, z: 0.5 },
  ), true)
})

test('l’occupation dynamique conserve plusieurs occupants dans un même volume', () => {
  const occupants = createOccupancyIndex([
    { id: 'token-a', point: { x: 1, y: 0, z: 1 } },
    { id: 'token-b', point: { x: 1, y: 0, z: 1 } },
  ])
  const bounds = actorBoundsAt({ x: 1, y: 0, z: 1 })

  assert.deepEqual(occupants.queryBounds(bounds).map(item => item.id), ['token-a', 'token-b'])
  assert.equal(occupants.canOccupy({ x: 1, y: 0, z: 1 }, {}, { excludeIds: ['token-a'] }), false)
  assert.equal(occupants.canOccupy(
    { x: 1, y: 0, z: 1 },
    {},
    { excludeIds: ['token-a', 'token-b'] },
  ), true)
})

// BUG-DEPLACEMENT1 (Saar, 2026-09-17) — une caisse à 0,90 m de distance réelle (diagonale) d'un
// nœud de déplacement le bloquait alors que la somme des rayons circulaires n'était que de 0,764 m
// (0,35 pour l'acteur + 0,414 pour l'entité) : `canOccupy` ne testait que les boîtes carrées
// (`actorBoundsAt`), jamais la distance circulaire réelle. Chiffres exacts reproduits ici.
test('deux occupants circulaires dont les boîtes carrées se touchent en diagonale ne se bloquent pas réellement', () => {
  const actorProfile = { radius: 0.35, height: 1.8, maxStepHeight: 0.5 }
  const nodePoint = { x: 1.5, y: 0.125, z: 2.5 } // nœud de déplacement le plus proche du token bloqué
  const entityPoint = { x: 1, y: 0.125, z: 1.75 } // caisse réelle, campagne de Saar
  const entityProfile = { radius: 0.414, height: 0.518, maxStepHeight: 0.5 }

  // Distance réelle nœud/entité ~0,90 m > 0,35+0,414 (0,764) — aucun chevauchement circulaire réel,
  // contrairement à ce que les boîtes carrées laissaient croire avant le correctif.
  assert.equal(actorFootprintsOverlap(nodePoint, actorProfile, entityPoint, entityProfile), false)

  const occupants = createOccupancyIndex([
    { id: 'entity-crate', point: entityPoint, actorProfile: entityProfile },
  ])
  assert.equal(occupants.canOccupy(nodePoint, actorProfile), true)
})

test('deux occupants circulaires qui se chevauchent réellement restent bloqués', () => {
  const profileA = { radius: 0.35, height: 1.8, maxStepHeight: 0.5 }
  const profileB = { radius: 0.414, height: 0.518, maxStepHeight: 0.5 }
  const pointA = { x: 1, y: 0.125, z: 1 }
  const pointB = { x: 1.3, y: 0.125, z: 1 } // distance 0.3 < 0.35+0.414 — chevauchement réel

  assert.equal(actorFootprintsOverlap(pointA, profileA, pointB, profileB), true)

  const occupants = createOccupancyIndex([{ id: 'entity-crate', point: pointB, actorProfile: profileB }])
  assert.equal(occupants.canOccupy(pointA, profileA), false)
})

test('un collider incliné utilise son prisme orienté et non toute sa boîte englobante', () => {
  const geometry = {
    type: 'wall-segment',
    from: { x: 0, z: 0 },
    to: { x: 1, z: 1 },
    minY: 0,
    maxY: 2.5,
    thickness: 0.1,
  }
  const diagonal = createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{
        id: 'diagonal', sourceId: 'diagonal', kind: 'wall', geometry,
        bounds: { min: { x: -0.05, y: 0, z: -0.05 }, max: { x: 1.05, y: 2.5, z: 1.05 } },
      }],
    },
  })
  const index = createSpatialIndex(diagonal)
  const actor = { radius: 0.05, height: 1.8, maxStepHeight: 0.5 }

  assert.equal(index.isSegmentClear({ x: 0.1, y: 0, z: 0.9 }, { x: 0.2, y: 0, z: 0.9 }, actor), true)
  assert.equal(index.isSegmentClear({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, actor), false)
})

test('un collider en arc tesselle la primitive canonique seulement pour le narrow phase', () => {
  const geometry = {
    type: 'wall-arc',
    center: { x: 0, z: 0 },
    radius: 1,
    startAngle: 0,
    sweep: Math.PI / 2,
    minY: 0,
    maxY: 2.5,
    thickness: 0.1,
  }
  const curved = createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{
        id: 'arc', sourceId: 'arc', kind: 'wall', geometry,
        bounds: { min: { x: -0.05, y: 0, z: -0.05 }, max: { x: 1.05, y: 2.5, z: 1.05 } },
      }],
    },
  })
  const index = createSpatialIndex(curved)
  const actor = { radius: 0.02, height: 1.8, maxStepHeight: 0.5 }

  assert.equal(index.isSegmentClear({ x: 0.1, y: 0, z: 0.5 }, { x: 0.3, y: 0, z: 0.5 }, actor), true)
  assert.equal(index.isSegmentClear({ x: 0.1, y: 0, z: 0.5 }, { x: 1.2, y: 0, z: 0.5 }, actor), false)
})

test('le narrow phase suit le profil vertical et l épaisseur variable d un mur', () => {
  const base = {
    type: 'wall-segment',
    from: { x: 0, z: 0 },
    to: { x: 1, z: 0 },
    minY: 0,
    maxY: 2.5,
    thickness: 0.1,
    elevationProfileOriginY: 0,
    elevationProfileHeight: 2.5,
  }
  const translated = {
    ...base,
    elevationProfileMode: 'translated',
    elevationProfile: { type: 'curved', depth: 1, direction: 1 },
    elevationProfileDirection: 1,
  }
  assert.ok(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: 0.8 },
    { x: 0.5, y: 1.25, z: 1.2 },
    translated,
  ))
  assert.equal(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: -0.2 },
    { x: 0.5, y: 1.25, z: 0.2 },
    translated,
  ), null)
  assert.ok(segmentGeometryInterval(
    { x: -0.25, y: 1.25, z: 0.8 },
    { x: -0.25, y: 1.25, z: 1.2 },
    { ...translated, profileJoinStartPadding: 0.5 },
  ))

  const sharedFace = {
    ...base,
    elevationProfileMode: 'faces',
    frontElevationProfile: { type: 'faceted', depth: 0.8, direction: 1 },
  }
  assert.ok(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: 0.6 },
    { x: 0.5, y: 1.25, z: 1 },
    sharedFace,
  ))
  assert.equal(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: -0.5 },
    { x: 0.5, y: 1.25, z: -0.2 },
    sharedFace,
  ), null)
})

// PLAN_FORME_COLLISION_ENTITES.md — un cercle basé sur max(width,depth)/2 sur-estimait le blocage
// d'une entité allongée. Chiffres réels du plan (« Lot de caisses assorties »,
// width=2,259m/depth=1,049m → halfWidth=1,1295/halfDepth=0,5245).
test('un token sur le côté étroit d’une entité allongée n’est plus bloqué (ancien rayon buggé : 1,13m)', () => {
  const rectProfile = { shape: 'rect', halfWidth: 1.1295, halfDepth: 0.5245, height: 0.86, maxStepHeight: 0.5 }
  const entityPoint = { x: 0, y: 0.125, z: 0 }
  const tokenPoint = { x: 0, y: 0.125, z: 1 } // 1m du centre sur l'axe court (depth) — visuellement libre
  const tokenProfile = { radius: 0.35, height: 1.8, maxStepHeight: 0.5 }

  // Ancien comportement (cercle, rayon max(2.259,1.049)/2 = 1,1295) : 1 < 1,1295+0,35 → bloqué à tort.
  assert.equal(actorFootprintsOverlap(tokenPoint, tokenProfile, entityPoint, rectProfile), false)

  const occupants = createOccupancyIndex([{ id: 'crate-pack', point: entityPoint, actorProfile: rectProfile }])
  assert.equal(occupants.canOccupy(tokenPoint, tokenProfile), true)
})

test('un token vraiment posé contre le côté étroit de la même entité reste bloqué', () => {
  const rectProfile = { shape: 'rect', halfWidth: 1.1295, halfDepth: 0.5245, height: 0.86, maxStepHeight: 0.5 }
  const entityPoint = { x: 0, y: 0.125, z: 0 }
  const tokenPoint = { x: 0, y: 0.125, z: 0.8 } // 0,8m du centre — dans le rayon du token (0,35) au-delà du bord (0,5245)
  const tokenProfile = { radius: 0.35, height: 1.8, maxStepHeight: 0.5 }

  assert.equal(actorFootprintsOverlap(tokenPoint, tokenProfile, entityPoint, rectProfile), true)
  const occupants = createOccupancyIndex([{ id: 'crate-pack', point: entityPoint, actorProfile: rectProfile }])
  assert.equal(occupants.canOccupy(tokenPoint, tokenProfile), false)
})

test('un token proche du COIN d’une entité rectangulaire est jugé par la vraie géométrie, pas le rayon enveloppe', () => {
  // À 1,1m en diagonale (X et Z), hors de portée d'un cercle inscrit dans le rectangle mais dans
  // l'enveloppe (demi-diagonale ~1,245m) — vérifie que le narrow-phase clamp (pas juste le broad-phase)
  // tranche correctement au coin, cas jamais couvert par un simple test cercle-cercle.
  const rectProfile = { shape: 'rect', halfWidth: 1.1295, halfDepth: 0.5245, height: 0.86, maxStepHeight: 0.5 }
  const entityPoint = { x: 0, y: 0.125, z: 0 }
  const cornerFar = { x: 1.5, y: 0.125, z: 1.0 } // clamp → (1.1295, 0.5245), distance ≈ 0,54m > 0,35 → libre
  const cornerNear = { x: 1.3, y: 0.125, z: 0.7 } // clamp → (1.1295, 0.5245), distance ≈ 0,26m < 0,35 → bloqué
  const tokenProfile = { radius: 0.35, height: 1.8, maxStepHeight: 0.5 }

  assert.equal(actorFootprintsOverlap(cornerFar, tokenProfile, entityPoint, rectProfile), false)
  assert.equal(actorFootprintsOverlap(cornerNear, tokenProfile, entityPoint, rectProfile), true)
})

test('rectangle vs rectangle (deux entités) — chevauchement réel bloque, un écart suffisant libère', () => {
  const profileA = { shape: 'rect', halfWidth: 1.1295, halfDepth: 0.5245, height: 0.86, maxStepHeight: 0.5 }
  const profileB = { shape: 'rect', halfWidth: 0.4, halfDepth: 0.4, height: 0.5, maxStepHeight: 0.5 }
  const pointA = { x: 0, y: 0.125, z: 0 }

  // Écart : bords à halfWidthA(1.1295)+halfWidthB(0.4)=1.5295 sur X — 1.6 > 1.5295 → libre.
  assert.equal(actorFootprintsOverlap(pointA, profileA, { x: 1.6, y: 0.125, z: 0 }, profileB), false)
  // Chevauchement : 1.4 < 1.5295 → bloqué.
  assert.equal(actorFootprintsOverlap(pointA, profileA, { x: 1.4, y: 0.125, z: 0 }, profileB), true)
})

test('non-régression : un profil shape:\'circle\' explicite se comporte identiquement à l’ancien défaut implicite', () => {
  const profileA = { shape: 'circle', radius: 0.35, height: 1.8, maxStepHeight: 0.5 }
  const profileB = { shape: 'circle', radius: 0.414, height: 0.518, maxStepHeight: 0.5 }
  const pointA = { x: 1, y: 0.125, z: 1 }
  const pointB = { x: 1.3, y: 0.125, z: 1 }
  assert.equal(actorFootprintsOverlap(pointA, profileA, pointB, profileB), true)
  assert.equal(actorFootprintsOverlap(pointA, profileA, { x: 3, y: 0.125, z: 1 }, profileB), false)
})

test('broad-phase : le rayon enveloppe d’un profil rect est la demi-diagonale, jamais moins', () => {
  const rectProfile = normalizeActorProfile({ shape: 'rect', halfWidth: 1.1295, halfDepth: 0.5245 })
  assert.ok(Math.abs(rectProfile.radius - Math.hypot(1.1295, 0.5245)) < 1e-9)

  // Un occupant à la limite de l'enveloppe (mais hors de la vraie forme rectangulaire) doit rester
  // un candidat du broad-phase (queryBounds) — c'est le narrow-phase qui l'élimine ensuite, jamais
  // le broad-phase lui-même (sur-ensemble garanti, aucun faux négatif).
  const bounds = actorBoundsAt({ x: 0, y: 0, z: 0 }, rectProfile)
  assert.ok(bounds.max.x - bounds.min.x >= 2 * 1.1295)
  const occupants = createOccupancyIndex([{ id: 'crate-pack', point: { x: 0, y: 0, z: 0 }, actorProfile: rectProfile }])
  const farCornerQuery = actorBoundsAt({ x: 1.5, y: 0, z: 1.0 }, { radius: 0.35, height: 1.8, maxStepHeight: 0.5 })
  assert.deepEqual(occupants.queryBounds(farCornerQuery).map(o => o.id), ['crate-pack'])
})
