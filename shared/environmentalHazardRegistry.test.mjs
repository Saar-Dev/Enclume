import test from 'node:test'
import assert from 'node:assert/strict'

import { ENVIRONMENTAL_HAZARD_REGISTRY, findHazardRegistryEntry } from './environmentalHazardRegistry.js'

test('registre — 3 codes RAW (Acide/Décompression/Feu), Décompression seule avec forcedLocation', () => {
  assert.deepEqual(ENVIRONMENTAL_HAZARD_REGISTRY, [
    { code: 'acid',          forcedLocation: null, lingersOnClear: true },
    { code: 'decompression', forcedLocation: 'corps' },
    { code: 'burning',       forcedLocation: null },
  ])
})

test('lingersOnClear — Acide seulement (RAW : persiste 1D6 Tours après retrait), jamais Feu/Décompression', () => {
  assert.equal(findHazardRegistryEntry('acid').lingersOnClear, true)
  assert.equal(findHazardRegistryEntry('burning').lingersOnClear, undefined)
  assert.equal(findHazardRegistryEntry('decompression').lingersOnClear, undefined)
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
