import test from 'node:test'
import assert from 'node:assert/strict'

import { computeTotalWeight, containerFillKg, containerState, fitsInContainer } from './inventoryMath.js'

// Capacité des conteneurs — règle R5 de « Permuter » (docs/Old/PLAN_PRISE_EN_MAIN.md).

test('computeTotalWeight — inchangé : le Coffre et les poids absents ne comptent pas, quantité multipliée', () => {
  assert.equal(computeTotalWeight([
    { container: 'Sac', ref_weight: 2, quantity: 3 },
    { container: 'Coffre', ref_weight: 100, quantity: 1 },
    { container: 'Ceinture', ref_weight: null, quantity: 5 },
  ]), 6)
})

test('containerFillKg — seuls les objets RANGÉS (sans emplacement) du conteneur demandé comptent', () => {
  const items = [
    { container: 'Sac', slots: null, ref_weight: 1, quantity: 2 },        // rangé au Sac : 2
    { container: 'Sac', slots: [], ref_weight: 0.5, quantity: 1 },        // slots vide = rangé : 0,5
    { container: 'Sac', slots: ['MD'], ref_weight: 6, quantity: 1 },      // arme en main : équipée, ne compte pas
    { container: 'Sac', slots: ['D'], ref_weight: 1.6, quantity: 1 },     // le Sac lui-même : ne compte pas
    { container: 'Sac', slots: ['BG', 'C', 'MG'], ref_weight: 4, quantity: 1 }, // bouclier composite tenu
    { container: 'Ceinture', slots: null, ref_weight: 0.3, quantity: 1 }, // autre conteneur
    { container: 'Coffre', slots: null, ref_weight: 50, quantity: 1 },    // stockage distant
    { container: 'Sac', slots: null, ref_weight: null, quantity: 9 },     // poids absent = 0
  ]
  assert.equal(containerFillKg(items, 'Sac'), 2.5)
  assert.equal(containerFillKg(items, 'Ceinture'), 0.3)
  assert.equal(containerFillKg([], 'Sac'), 0)
  assert.equal(containerFillKg(undefined, 'Sac'), 0)
})

test('containerState — équipé (slot D / Ce) : disponible, capacité lue ; sans objet équipé : indisponible', () => {
  const items = [
    { container: 'Sac', slots: ['D'], ref_capacity: 25, ref_weight: 1.6, quantity: 1 },
    { container: 'Ceinture', slots: ['Ce'], ref_capacity: 3, ref_weight: 0.5, quantity: 1 },
    { container: 'Sac', slots: null, ref_weight: 2, quantity: 1 },
  ]
  assert.deepEqual(containerState(items, 'Sac'), { available: true, capacityKg: 25, fillKg: 2 })
  assert.deepEqual(containerState(items, 'Ceinture'), { available: true, capacityKg: 3, fillKg: 0 })
  assert.deepEqual(containerState([items[2]], 'Sac'), { available: false, capacityKg: null, fillKg: 2 })
  assert.equal(containerState(items, 'Coffre').available, false)
})

test('containerState — capacité NULL (bouteille en emplacement D) = sans limite ; capacité textuelle numérique lue comme un nombre', () => {
  assert.equal(containerState([{ container: 'Sac', slots: ['D'], ref_capacity: null }], 'Sac').capacityKg, null)
  assert.equal(containerState([{ container: 'Sac', slots: ['D'], ref_capacity: '15' }], 'Sac').capacityKg, 15)
})

test('fitsInContainer — après ≤ max(capacité, avant) : conforme reste conforme, trop plein n’est jamais aggravé', () => {
  assert.equal(fitsInContainer({ capacityKg: 3, fillKg: 1, deltaKg: 2 }), true)      // pile la capacité
  assert.equal(fitsInContainer({ capacityKg: 3, fillKg: 1, deltaKg: 2.5 }), false)   // dépasse
  assert.equal(fitsInContainer({ capacityKg: 8, fillKg: 10, deltaKg: -1 }), true)    // déjà trop plein, allégé
  assert.equal(fitsInContainer({ capacityKg: 8, fillKg: 10, deltaKg: 0 }), true)     // déjà trop plein, inchangé
  assert.equal(fitsInContainer({ capacityKg: 8, fillKg: 10, deltaKg: 0.5 }), false)  // déjà trop plein, aggravé
  assert.equal(fitsInContainer({ capacityKg: null, fillKg: 999, deltaKg: 999 }), true) // sans limite
})

test('fitsInContainer — les poids sont des `real` : trois grenades de 0,3 kg tiennent dans 0,9 kg malgré l’arrondi flottant', () => {
  const grenade = Math.fround(0.3) // 0.30000001192092896, la valeur réellement lue en base
  assert.equal(fitsInContainer({ capacityKg: 0.9, fillKg: 0, deltaKg: grenade * 3 }), true)
  assert.equal(fitsInContainer({ capacityKg: 0.9, fillKg: 0, deltaKg: grenade * 4 }), false)
})
