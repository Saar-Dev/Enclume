import assert from 'node:assert/strict'
import test from 'node:test'

import { isDoorConnectorBlueprint, isElevatorConnectorBlueprint } from './connectorBlueprintCatalog.js'

test('les portes legacy du pack futuriste restent dans le catalogue', () => {
  assert.equal(isDoorConnectorBlueprint({
    label: 'Double battant',
    glb_url: 'builtin-models/futuristic_doors/double.glb',
    geometry: {},
  }), true)
})

test('un connectorType door est une porte même sans mot-clé historique', () => {
  assert.equal(isDoorConnectorBlueprint({
    label: 'Passage principal',
    geometry: { connectorType: 'door' },
  }), true)
})

test('une trappe est toujours exclue des portes, même si son nom contient sas ou door', () => {
  assert.equal(isDoorConnectorBlueprint({
    label: 'Sas hatch door rond',
    glb_url: 'builtin-models/futuristic_doors/hatch.glb',
    geometry: { connectorType: 'hatch' },
  }), false)
})

test('un objet sans métadonnée ni mot-clé de porte reste hors du catalogue', () => {
  assert.equal(isDoorConnectorBlueprint({
    label: 'Caisse technique',
    geometry: { connectorType: null },
  }), false)
})

test('les catalogues portes et ascenseurs restent strictement séparés', () => {
  const elevator = {
    label: 'Ascenseur avec porte large',
    geometry: { connectorType: 'elevator' },
  }
  assert.equal(isDoorConnectorBlueprint(elevator), false)
  assert.equal(isElevatorConnectorBlueprint(elevator), true)
  assert.equal(isElevatorConnectorBlueprint({ geometry: { connectorType: 'door' } }), false)
})
