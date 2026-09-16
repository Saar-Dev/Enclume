import test from 'node:test'
import assert from 'node:assert/strict'

import { selectDisconnectedSystems } from './exoSystemsCapacity.js'

// Exemple RAW (docs/REGLES/REGLE_ORDINATEUR.md p.280) : Gén. V / NT III → 25 systèmes gérés.
// Ici capacité réduite à 2 pour un test lisible : les 2 premiers (sort_order croissant) restent
// actifs, le 3e est déconnecté.
test('selectDisconnectedSystems — capacité dépassée : les systèmes les moins importants (sort_order le plus élevé) sont déconnectés', () => {
  const a = { id: 'a', sort_order: 0 }
  const b = { id: 'b', sort_order: 1 }
  const c = { id: 'c', sort_order: 2 }
  const result = selectDisconnectedSystems({ gestionSystemes: 2, systems: [c, a, b] })
  assert.deepEqual(result.active, [a, b])
  assert.deepEqual(result.disconnected, [c])
})

test('selectDisconnectedSystems — capacité suffisante : rien de déconnecté', () => {
  const a = { id: 'a', sort_order: 0 }
  const b = { id: 'b', sort_order: 1 }
  const result = selectDisconnectedSystems({ gestionSystemes: 25, systems: [a, b] })
  assert.deepEqual(result.active, [a, b])
  assert.deepEqual(result.disconnected, [])
})

test('selectDisconnectedSystems — capacité exactement égale au nombre de systèmes : rien de déconnecté', () => {
  const a = { id: 'a', sort_order: 0 }
  const b = { id: 'b', sort_order: 1 }
  const result = selectDisconnectedSystems({ gestionSystemes: 2, systems: [a, b] })
  assert.deepEqual(result.active, [a, b])
  assert.deepEqual(result.disconnected, [])
})

test('selectDisconnectedSystems — gestionSystemes null (aucun ordinateur actif) : tout est déconnecté', () => {
  const a = { id: 'a', sort_order: 0 }
  const b = { id: 'b', sort_order: 1 }
  const result = selectDisconnectedSystems({ gestionSystemes: null, systems: [b, a] })
  assert.deepEqual(result.active, [])
  assert.deepEqual(result.disconnected, [a, b])
})

test('selectDisconnectedSystems — capacité 0 : tout est déconnecté', () => {
  const a = { id: 'a', sort_order: 0 }
  const result = selectDisconnectedSystems({ gestionSystemes: 0, systems: [a] })
  assert.deepEqual(result.active, [])
  assert.deepEqual(result.disconnected, [a])
})

test('selectDisconnectedSystems — aucun système : listes vides, jamais une erreur', () => {
  assert.deepEqual(selectDisconnectedSystems({ gestionSystemes: 10, systems: [] }), { active: [], disconnected: [] })
  assert.deepEqual(selectDisconnectedSystems({ gestionSystemes: 10 }), { active: [], disconnected: [] })
})

test('selectDisconnectedSystems — égalité de sort_order départagée par id, tri stable et déterministe', () => {
  const a = { id: 'aaa', sort_order: 0 }
  const b = { id: 'bbb', sort_order: 0 }
  const result = selectDisconnectedSystems({ gestionSystemes: 1, systems: [b, a] })
  assert.deepEqual(result.active, [a])
  assert.deepEqual(result.disconnected, [b])
})

test('selectDisconnectedSystems — n\'altère jamais les tableaux/objets d\'entrée', () => {
  const systems = [{ id: 'b', sort_order: 1 }, { id: 'a', sort_order: 0 }]
  const original = JSON.parse(JSON.stringify(systems))
  selectDisconnectedSystems({ gestionSystemes: 1, systems })
  assert.deepEqual(systems, original)
})
