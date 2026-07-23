import test from 'node:test'
import assert from 'node:assert/strict'

import {
  elevatorCabinIsAtStop,
  elevatorInteractionStop,
  selectElevatorActorToken,
} from './elevatorInteraction.js'

const connector = {
  width: 2,
  depth: 1,
  cabinHeight: 2.2,
  stops: [
    { id: 'bas', level: 0, x: 0, y: 0.125, z: 0 },
    { id: 'haut', level: 1, x: 0, y: 2.625, z: 0 },
    { id: 'droite', level: 1, x: 4, y: 2.625, z: 0 },
  ],
}

test('le clic sur une gaine résout le palier spatialement le plus proche', () => {
  assert.equal(elevatorInteractionStop(connector, { x: 5, y: 3.5, z: 0.5 }).id, 'droite')
  assert.equal(elevatorInteractionStop(connector, null, 0).id, 'bas')
})

test('la cabine est présente seulement si son arrêt et ses coordonnées coïncident', () => {
  assert.equal(elevatorCabinIsAtStop({
    phase: 'idle', currentStopId: 'haut', positionX: 0, positionY: 2.625, positionZ: 0,
  }, connector.stops[1], connector.stops[0]), true)
  assert.equal(elevatorCabinIsAtStop({
    phase: 'moving', currentStopId: 'haut', positionX: 1, positionY: 2.625, positionZ: 0,
  }, connector.stops[1], connector.stops[0]), false)
})

test('le token sélectionné du MJ prime, sinon le joueur utilise son token possédé', () => {
  const tokens = [{ id: 'pnj', character_id: 'c2' }, { id: 'pj', character_id: 'c1' }]
  const characters = [{ id: 'c1', user_id: 'u1' }, { id: 'c2', user_id: 'u2' }]
  assert.equal(selectElevatorActorToken({ tokens, characters, userId: 'u1' }).id, 'pj')
  assert.equal(selectElevatorActorToken({ tokens, characters, userId: 'u1', isGm: true, selectedTokenId: 'pnj' }).id, 'pnj')
})
