import test from 'node:test'
import assert from 'node:assert/strict'

import { ECHEANCE_TYPE_REGISTRY, findEcheanceRegistryEntry } from './echeanceTypeRegistry.js'

test('registre vide en Lot 2 (socle) — aucun consommateur encore branché', () => {
  assert.deepEqual(ECHEANCE_TYPE_REGISTRY, [])
})

test('condition_type inconnu -> undefined, jamais un throw', () => {
  assert.equal(findEcheanceRegistryEntry('inconnu'), undefined)
  assert.equal(findEcheanceRegistryEntry(null), undefined)
  assert.equal(findEcheanceRegistryEntry(undefined), undefined)
})

test('lookup par clé retrouve la bonne entrée une fois le registre peuplé', () => {
  const fakeHandler = async () => ({ resolved: true, effects: [], reschedule: null, spawn: [], undoEntries: [] })
  ECHEANCE_TYPE_REGISTRY.push({ key: 'test_condition', interactive: false, handler: fakeHandler })
  try {
    const entry = findEcheanceRegistryEntry('test_condition')
    assert.equal(entry.interactive, false)
    assert.equal(entry.handler, fakeHandler)
    assert.equal(findEcheanceRegistryEntry('autre_condition'), undefined)
  } finally {
    ECHEANCE_TYPE_REGISTRY.length = 0
  }
})
