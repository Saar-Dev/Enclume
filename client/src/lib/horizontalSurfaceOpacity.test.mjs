import test from 'node:test'
import assert from 'node:assert/strict'
import { horizontalInterfaceOpacity } from './horizontalSurfaceOpacity.js'

test('depuis le niveau bas, une interface partagée reste le plafond découpé de la salle basse', () => {
  assert.equal(horizontalInterfaceOpacity({
    displayLevel: 0,
    ceilingDisplayLevel: 0,
    belongsToCameraVolume: false,
    ceilingOpacity: 0.18,
  }), 0.18)
})

test('le plafond d un niveau inférieur reste entièrement opaque', () => {
  assert.equal(horizontalInterfaceOpacity({
    displayLevel: 1,
    ceilingDisplayLevel: 0,
    belongsToCameraVolume: false,
    ceilingOpacity: 0.18,
  }), 1)
})

test('le plafond courant d un volume multi-niveau actif conserve la coupe', () => {
  assert.equal(horizontalInterfaceOpacity({
    displayLevel: 0,
    ceilingDisplayLevel: 2,
    belongsToCameraVolume: true,
    ceilingOpacity: 0.18,
  }), 0.18)
})
