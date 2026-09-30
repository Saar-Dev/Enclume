import test from 'node:test'
import assert from 'node:assert/strict'

import { computeConnectorPlacement } from './computeConnectorPlacement.js'
import { applyDoorConnector, applyElevatorConnector, applyLadderConnector } from '../connectors.js'

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

const dragEnd = { x: 0, z: 0, fx: 0, fz: 0 }

test('computeConnectorPlacement(door) équivaut à applyDoorConnector direct', () => {
  const surface = emptySurface()
  const tool = { connectorType: 'door' }
  assert.deepEqual(
    computeConnectorPlacement(surface, dragEnd, tool),
    applyDoorConnector(surface, dragEnd, tool),
  )
})

test('computeConnectorPlacement(ladder) équivaut à applyLadderConnector direct', () => {
  const surface = emptySurface()
  const tool = { connectorType: 'ladder' }
  assert.deepEqual(
    computeConnectorPlacement(surface, dragEnd, tool),
    applyLadderConnector(surface, dragEnd, tool),
  )
})

test('computeConnectorPlacement(elevator, ou tout autre type) équivaut à applyElevatorConnector direct', () => {
  const surface = emptySurface()
  const tool = { connectorType: 'elevator' }
  assert.deepEqual(
    computeConnectorPlacement(surface, dragEnd, tool),
    applyElevatorConnector(surface, dragEnd, tool),
  )
  // Repli : tout connectorType ni 'door' ni 'ladder' retombe sur l'ascenseur, comme le code d'origine.
  const otherTool = { connectorType: 'anything-else' }
  assert.deepEqual(
    computeConnectorPlacement(surface, dragEnd, otherTool),
    applyElevatorConnector(surface, dragEnd, otherTool),
  )
})
