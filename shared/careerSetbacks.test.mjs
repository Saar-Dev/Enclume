import test from 'node:test'
import assert from 'node:assert/strict'

import { getSetbackBlockCount, resolveSetback, mapSetbackToCareerBlock } from './careerSetbacks.js'

test('getSetbackBlockCount — aucune tranche due avant l\'an 13', () => {
  assert.equal(getSetbackBlockCount(10), 0)
  assert.equal(getSetbackBlockCount(12), 0)
})

test('getSetbackBlockCount — une tranche de plus tous les 3 ans a partir de 13', () => {
  assert.equal(getSetbackBlockCount(13), 1)
  assert.equal(getSetbackBlockCount(15), 1)
  assert.equal(getSetbackBlockCount(16), 2)
  assert.equal(getSetbackBlockCount(19), 3)
})

test('resolveSetback — trouve la ligne dont la plage couvre le jet', () => {
  const rows = [{ name: 'A', roll_min: 1, roll_max: 20 }, { name: 'B', roll_min: 21, roll_max: 25 }]
  assert.equal(resolveSetback(25, rows).name, 'B')
  assert.equal(resolveSetback(1, rows).name, 'A')
  assert.equal(resolveSetback(200, rows), null)
})

test('mapSetbackToCareerBlock — 2e carriere, 1re tranche (annee 13 = 3e annee de la 2e carriere)', () => {
  const careers = [{ years: 10 }, { years: 8 }]
  assert.deepEqual(mapSetbackToCareerBlock(0, careers), { careerIndex: 1, blockIndexWithinCareer: 0 })
})

test('mapSetbackToCareerBlock — meme carriere, tranche suivante (annee 16 = 6e annee, reliquat)', () => {
  const careers = [{ years: 10 }, { years: 8 }]
  assert.deepEqual(mapSetbackToCareerBlock(1, careers), { careerIndex: 1, blockIndexWithinCareer: 1 })
})

test('mapSetbackToCareerBlock — une seule carriere assez longue', () => {
  const careers = [{ years: 25 }]
  // Année 13 -> tranche 2 (années 11-15, index 2 = 3e tranche de 5 ans, 0-indexee).
  assert.deepEqual(mapSetbackToCareerBlock(0, careers), { careerIndex: 0, blockIndexWithinCareer: 2 })
})

test('mapSetbackToCareerBlock — annee cumulee au-dela du total -> null', () => {
  const careers = [{ years: 10 }]
  assert.equal(mapSetbackToCareerBlock(0, careers), null) // année 13 > 10 années totales
})
