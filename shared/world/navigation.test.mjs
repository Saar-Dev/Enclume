import test from 'node:test'
import assert from 'node:assert/strict'

import { compileSurfaceWorld } from './worldCompiler.js'
import { createWorldSnapshot } from './worldContracts.js'
import { buildNavigationGraph, planWorldPath } from './navigation.js'
import { compileEffectRegions } from './worldEffects.js'

function emptySurface(patch = {}) {
  return {
    version: 4,
    fine: 4,
    storyHeight: 2.5,
    rooms: {}, floors: {}, walls: {}, ceilings: {}, stairs: {}, connectors: {},
    ...patch,
  }
}

function room(id, minX, maxX, patch = {}) {
  return {
    id,
    minX,
    maxX,
    minZ: 0,
    maxZ: 0,
    y: 0,
    heightLevels: 1,
    floorThickness: 0.25,
    ceilingThickness: 0.25,
    wallThickness: 1,
    floorEnabled: true,
    ceilingEnabled: true,
    wallEnabled: true,
    barrierType: 'solid',
    ...patch,
  }
}

test('le budget s’arrête sur la dernière position stable au sol', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-budget',
    worldRevision: 3,
    surfaceData: emptySurface({ rooms: { roomA: room('roomA', 0, 2) } }),
  })
  const result = planWorldPath({
    snapshot,
    from: { x: 0.5, y: 0.125, z: 0.5 },
    to: { x: 2.5, y: 0.125, z: 0.5 },
    budgetM: 2,
  })

  assert.equal(result.status, 'budget')
  assert.equal(result.plan.spentM, 1.5)
  assert.deepEqual(result.plan.end, { x: 1.5, y: 0.125, z: 0.5 })
})

test('le multiplicateur MJ de la surface pondère l’entrée sur la case', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-surface-cost',
    surfaceData: emptySurface({
      floors: {
        '0:0:0': { x: 0, z: 0, y: 0, thickness: 0.25, movementMultiplier: 1 },
        '1:0:0': { x: 1, z: 0, y: 0, thickness: 0.25, movementMultiplier: 5 },
      },
    }),
  })
  const result = planWorldPath({
    snapshot,
    from: { x: 0.5, y: 0.125, z: 0.5 },
    to: { x: 1.5, y: 0.125, z: 0.5 },
    budgetM: 8,
  })
  assert.equal(result.routeCostM, 7.5)
  assert.equal(result.plan.spentM, 7.5)
})

test('la cabine est navigable seulement lorsqu’elle est alignée avec ses portes ouvertes', () => {
  const surfaceData = emptySurface({
    rooms: { roomA: room('roomA', 0, 1) },
    connectors: {
      liftA: {
        id: 'liftA', type: 'elevator', x: 0, z: 0,
        fromLevel: 0, toLevel: 2, doorAxis: 'x', doorSide: 1,
      },
    },
  })
  const open = compileSurfaceWorld({ battlemapId: 'map-elevator-nav', surfaceData })
  const boarded = planWorldPath({
    snapshot: open,
    from: { x: 1.5, y: 0.125, z: 0.5 },
    to: { x: 0.5, y: 0.125, z: 0.5 },
    budgetM: 10,
  })
  assert.equal(boarded.status, 'destination')

  const elevatorId = open.spatial.supports.find(item => item.kind === 'elevator-cabin').sourceId
  const moving = compileSurfaceWorld({
    battlemapId: 'map-elevator-nav',
    surfaceData,
    runtimeState: { featureStates: {
      [elevatorId]: {
        phase: 'moving', currentStopId: 'level:0', targetStopId: 'level:2',
        positionY: 2.625, doorState: 'closed', queue: [],
        transitionStartedAt: 0, transitionEndsAt: 10000,
        movementFromY: 0.125, movementToY: 5.125,
      },
    } },
  })
  const absent = planWorldPath({
    snapshot: moving,
    from: { x: 1.5, y: 0.125, z: 0.5 },
    to: { x: 0.5, y: 2.625, z: 0.5 },
    budgetM: 20,
  })
  assert.equal(absent.status, 'unreachable')
})

test('un effet volumique pondère A* et le plan avec la même catégorie environnement', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-effect-cost',
    surfaceData: emptySurface({
      floors: {
        '0:0:0': { x: 0, z: 0, y: 0, thickness: 0.25 },
        '1:0:0': { x: 1, z: 0, y: 0, thickness: 0.25 },
      },
    }),
  })
  const effectRegions = compileEffectRegions(snapshot, {
    instances: [{
      id: 'oil-path',
      definitionKey: 'oil',
      targetKind: 'volume',
      volume: { min: { x: 1, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } },
    }],
  })
  const result = planWorldPath({
    snapshot,
    effectRegions,
    from: { x: 0.5, y: 0.125, z: 0.5 },
    to: { x: 1.5, y: 0.125, z: 0.5 },
    budgetM: 10,
  })
  assert.equal(result.routeCostM, 2.25)
  assert.equal(result.plan.segments[0].factors.environment[0].value, 1.5)
})

function adjacentRoomsWithDoor(state) {
  return emptySurface({
    rooms: {
      roomA: room('roomA', 0, 0),
      roomB: room('roomB', 1, 1),
    },
    connectors: {
      doorA: {
        id: 'doorA', type: 'door', axis: 'z',
        x0: 4, x1: 4, z0: 0, z1: 4, alongCenter: 2, y: 0,
        width: 1, depth: 0.25, height: 2, state,
        modelGeometry: { openingWidth: 1, wallCutWidth: 1 },
      },
    },
  })
}

test('une porte fermée coupe le graphe et la même porte ouverte le reconnecte', () => {
  const closed = compileSurfaceWorld({ battlemapId: 'door-closed', surfaceData: adjacentRoomsWithDoor('closed') })
  const open = compileSurfaceWorld({ battlemapId: 'door-open', surfaceData: adjacentRoomsWithDoor('open') })
  const request = {
    from: { x: 0.5, y: 0.125, z: 0.5 },
    to: { x: 1.5, y: 0.125, z: 0.5 },
    budgetM: 10,
  }

  assert.equal(planWorldPath({ snapshot: closed, ...request }).status, 'unreachable')
  assert.equal(planWorldPath({ snapshot: open, ...request }).status, 'destination')
})

test('une traversée de grimpe reste fractionnable et applique le facteur ×2', () => {
  const snapshot = createWorldSnapshot({
    battlemapId: 'climb-map',
    worldRevision: 4,
    spatial: {
      supports: [
        {
          id: 'support:bottom', sourceId: 'bottom', kind: 'floor', walkable: true,
          movementMultiplier: 1, y: 0,
          bounds: { min: { x: -1, y: -0.1, z: 0 }, max: { x: 0, y: 0, z: 1 } },
        },
        {
          id: 'support:top', sourceId: 'top', kind: 'floor', walkable: true,
          movementMultiplier: 1, y: 4,
          bounds: { min: { x: 0, y: 3.9, z: 0 }, max: { x: 1, y: 4, z: 1 } },
        },
      ],
      barriers: [], colliders: [], occluders: [], compartments: [], regions: [],
      traversals: [{
        id: 'traversal:ladder', sourceId: 'ladder', kind: 'ladder', mode: 'climb',
        from: { x: 0, y: 0, z: 0.5 }, to: { x: 0, y: 4, z: 0.5 },
        enabled: true, allowPartial: true, movementMultiplier: 2,
      }],
    },
  })
  const graph = buildNavigationGraph(snapshot)
  const result = planWorldPath({
    snapshot,
    graph,
    from: { x: -0.5, y: 0, z: 0.5 },
    to: { x: 0.5, y: 4, z: 0.5 },
    budgetM: 13.5,
  })

  const climbSegment = result.plan.segments.find(segment => segment.mode === 'climb')
  assert.ok(climbSegment)
  assert.equal(climbSegment.factor, 4)
  assert.equal(result.status, 'budget')
  assert.equal(result.plan.end.y > 0 && result.plan.end.y < 4, true)

  const continuation = planWorldPath({
    snapshot,
    graph,
    from: result.plan.end,
    to: { x: 0.5, y: 4, z: 0.5 },
    budgetM: 100,
  })
  assert.deepEqual(continuation.snappedFrom, result.plan.end)
  assert.deepEqual(continuation.plan.segments[0].from, result.plan.end)
  assert.equal(continuation.status, 'destination')
  assert.ok(Math.abs(continuation.routeCostM - (27.75 - result.plan.spentM)) < 1e-9)
})

test('un occupant dynamique bloque une destination sans écraser les autres occupants', () => {
  const snapshot = compileSurfaceWorld({
    battlemapId: 'map-occupancy',
    surfaceData: emptySurface({ rooms: { roomA: room('roomA', 0, 1) } }),
  })
  const result = planWorldPath({
    snapshot,
    from: { x: 0.5, y: 0.125, z: 0.5 },
    to: { x: 1.5, y: 0.125, z: 0.5 },
    budgetM: 10,
    occupants: [{ id: 'other-token', point: { x: 1.5, y: 0.125, z: 0.5 } }],
  })
  assert.equal(result.status, 'unreachable')
})
