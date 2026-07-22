import test from 'node:test'
import assert from 'node:assert/strict'

import {
  commandElevator,
  createInitialElevatorState,
  elevatorPassengerWorldPoint,
  normalizeElevatorDefinition,
  reconcileElevatorState,
  requestElevatorStop,
} from './elevatorRuntime.js'

const elevator = normalizeElevatorDefinition({
  id: 'elevator-test',
  x: 2,
  z: 3,
  fromLevel: 0,
  toLevel: 2,
  travelSecondsPerLevel: 2,
  doorSeconds: 1,
  dwellSeconds: 0.5,
})

test('la cabine ferme, se déplace physiquement puis ouvre au palier demandé', () => {
  const initial = createInitialElevatorState(elevator, { now: 0 })
  const requested = requestElevatorStop(elevator, initial, {
    stopId: 'level:2', requestId: 'r1', requestedAt: 0,
  })
  assert.equal(requested.phase, 'closing')
  assert.equal(requested.doorState, 'closing')

  const moving = reconcileElevatorState(elevator, requested, 2000)
  assert.equal(moving.phase, 'moving')
  assert.ok(moving.positionY > elevator.stops[0].y && moving.positionY < elevator.stops[2].y)

  const arrived = reconcileElevatorState(elevator, requested, 5500)
  assert.equal(arrived.phase, 'opening')
  assert.equal(arrived.currentStopId, 'level:2')

  const open = reconcileElevatorState(elevator, requested, 6000)
  assert.equal(open.phase, 'open')
  assert.equal(open.positionY, elevator.stops[2].y)
  assert.deepEqual(open.queue, [])
})

test('deux demandes concurrentes ont un ordre stable par date puis identité', () => {
  const initial = commandElevator(elevator, createInitialElevatorState(elevator), { type: 'close' }, 0)
  const firstArrival = requestElevatorStop(elevator, initial, {
    stopId: 'level:2', requestId: 'z-request', requestedAt: 50,
  })
  const secondArrival = requestElevatorStop(elevator, firstArrival, {
    stopId: 'level:1', requestId: 'a-request', requestedAt: 50,
  })
  assert.deepEqual(secondArrival.queue.map(request => request.id), ['a-request', 'z-request'])
})

test('une porte bloquée suspend l’automate puis reprend la transition restante', () => {
  const closing = requestElevatorStop(elevator, createInitialElevatorState(elevator), {
    stopId: 'level:1', requestId: 'r1', requestedAt: 0,
  })
  const blocked = commandElevator(elevator, closing, { type: 'block', reason: 'baril' }, 400)
  assert.equal(blocked.phase, 'blocked')
  assert.equal(reconcileElevatorState(elevator, blocked, 100000).positionY, closing.positionY)
  const resumed = commandElevator(elevator, blocked, { type: 'unblock' }, 100000)
  assert.equal(resumed.phase, 'closing')
  assert.equal(resumed.transitionEndsAt, 100600)
})

test('ouvrir inverse une fermeture au lieu de rester sans effet', () => {
  const closing = commandElevator(elevator, createInitialElevatorState(elevator), { type: 'close' }, 0)
  const opening = commandElevator(elevator, closing, { type: 'open' }, 250)
  assert.equal(opening.phase, 'opening')
  assert.equal(opening.doorState, 'opening')
  assert.equal(reconcileElevatorState(elevator, opening, 1250).phase, 'open')
})

test('utiliser ouvre immédiatement la cabine uniquement au palier où elle se trouve', () => {
  const closed = reconcileElevatorState(
    elevator,
    commandElevator(elevator, createInitialElevatorState(elevator), { type: 'close' }, 0),
    1000,
  )
  const used = commandElevator(elevator, closed, { type: 'use', stopId: 'level:0' }, 1000)
  assert.equal(used.phase, 'open')
  assert.equal(used.doorState, 'open')
  assert.throws(
    () => commandElevator(elevator, closed, { type: 'use', stopId: 'level:1' }, 1000),
    /pas présente/,
  )
})

test('un état sérialisé peut être réconcilié après redémarrage', () => {
  const requested = requestElevatorStop(elevator, createInitialElevatorState(elevator), {
    stopId: 'level:2', requestId: 'r1', requestedAt: 1000,
  })
  const restored = JSON.parse(JSON.stringify(requested))
  const result = reconcileElevatorState(elevator, restored, 8000)
  assert.equal(result.phase, 'open')
  assert.equal(result.currentStopId, 'level:2')
})

test('un passager conserve ses coordonnées locales quand la cabine monte', () => {
  const point = elevatorPassengerWorldPoint(elevator, { positionY: 5.125 }, { x: 0.5, y: 0, z: 0.5 })
  assert.deepEqual(point, { x: 2.5, y: 5.125, z: 3.5 })
})

test('un ascenseur dessiné depuis le haut démarre bien au palier choisi', () => {
  const descending = normalizeElevatorDefinition({
    id: 'elevator-descending', fromLevel: 2, toLevel: 0,
  })
  assert.equal(createInitialElevatorState(descending).currentStopId, 'level:2')
})

test('un trajet orthogonal conserve l’ordre des arrêts et tourne sans diagonale', () => {
  const routed = normalizeElevatorDefinition({
    id: 'elevator-route', width: 2, depth: 1,
    travelSecondsPerLevel: 1, travelSecondsPerUnit: 1, doorSeconds: 1,
    stops: [
      { id: 'a', level: 0, x: 1, y: 0, z: 1, doorAxis: 'z', doorSide: 1 },
      { id: 'b', level: 1, x: 1, y: 2.5, z: 1, doorAxis: 'x', doorSide: -1 },
      { id: 'c', level: 1, x: 4, y: 2.5, z: 1, doorAxis: 'z', doorSide: -1 },
    ],
  })
  assert.deepEqual(routed.stops.map(stop => stop.id), ['a', 'b', 'c'])
  assert.deepEqual(routed.stops.map(stop => [stop.doorAxis, stop.doorSide]), [['z', 1], ['x', -1], ['z', -1]])

  const requested = requestElevatorStop(routed, createInitialElevatorState(routed), {
    stopId: 'c', requestId: 'route', requestedAt: 0,
  })
  const atTurn = reconcileElevatorState(routed, requested, 2000)
  assert.equal(atTurn.phase, 'moving')
  assert.deepEqual(
    { x: atTurn.positionX, y: atTurn.positionY, z: atTurn.positionZ },
    { x: 1, y: 2.5, z: 1 },
  )
  const halfwayHorizontal = reconcileElevatorState(routed, requested, 3500)
  assert.equal(halfwayHorizontal.positionY, 2.5)
  assert.ok(halfwayHorizontal.positionX > 1 && halfwayHorizontal.positionX < 4)
})

test('un trajet diagonal est refusé', () => {
  assert.throws(() => normalizeElevatorDefinition({
    id: 'elevator-diagonal',
    stops: [
      { id: 'a', x: 0, y: 0, z: 0 },
      { id: 'b', x: 1, y: 2.5, z: 0 },
    ],
  }), /alignés/)
})
