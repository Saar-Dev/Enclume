import test from 'node:test'
import assert from 'node:assert/strict'

import { ENVIRONMENTAL_HAZARD_REGISTRY, findHazardRegistryEntry } from './environmentalHazardRegistry.js'

test('registre — 3 codes RAW (Acide/Décompression/Feu), Décompression seule avec forcedLocation', () => {
  assert.deepEqual(ENVIRONMENTAL_HAZARD_REGISTRY, [
    { code: 'acid',          forcedLocation: null },
    { code: 'decompression', forcedLocation: 'corps' },
    { code: 'burning',       forcedLocation: null },
  ])
})

test('findHazardRegistryEntry — lookup connu', () => {
  assert.equal(findHazardRegistryEntry('decompression').forcedLocation, 'corps')
  assert.equal(findHazardRegistryEntry('burning').forcedLocation, null)
})

test('findHazardRegistryEntry — code inconnu -> undefined, jamais un throw', () => {
  assert.equal(findHazardRegistryEntry('inconnu'), undefined)
  assert.equal(findHazardRegistryEntry(null), undefined)
  assert.equal(findHazardRegistryEntry(undefined), undefined)
})
