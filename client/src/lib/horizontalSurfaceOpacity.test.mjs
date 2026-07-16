import test from 'node:test'
import assert from 'node:assert/strict'
import { horizontalInterfaceOpacity } from './horizontalSurfaceOpacity.js'

test('une interface qui est aussi le sol de la salle supérieure reste opaque', () => {
  assert.equal(horizontalInterfaceOpacity({
    hasFloor: true,
    displayLevel: 0,
    ceilingDisplayLevel: 0,
    belongsToCameraVolume: false,
    ceilingOpacity: 0.18,
  }), 1)
})

test('un plafond sans salle au-dessus conserve la règle de coupe de caméra', () => {
  assert.equal(horizontalInterfaceOpacity({
    hasFloor: false,
    displayLevel: 0,
    ceilingDisplayLevel: 0,
    belongsToCameraVolume: false,
    ceilingOpacity: 0.18,
  }), 0.18)
})
