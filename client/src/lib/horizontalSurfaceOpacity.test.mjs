import test from 'node:test'
import assert from 'node:assert/strict'
import {
  horizontalInterfaceOpacity,
  horizontalInterfaceRenderKind,
} from './horizontalSurfaceOpacity.js'

test('une interface partagée est le plafond bas au niveau 0 puis le sol haut au niveau 1', () => {
  const sharedInterface = {
    hasFloor: true,
    floorDisplayLevel: 1,
    hasCeiling: true,
    ceilingDisplayLevel: 0,
    floorBelongsToCameraVolume: false,
    ceilingBelongsToCameraVolume: false,
  }

  assert.equal(horizontalInterfaceRenderKind({
    ...sharedInterface,
    displayLevel: 0,
  }), 'ceiling')
  assert.equal(horizontalInterfaceRenderKind({
    ...sharedInterface,
    displayLevel: 1,
  }), 'floor')
  assert.equal(horizontalInterfaceRenderKind({
    ...sharedInterface,
    displayLevel: 2,
  }), null)
})

test('le sol d un étage supérieur sans plafond inférieur reste caché avant son étage', () => {
  assert.equal(horizontalInterfaceRenderKind({
    hasFloor: true,
    floorDisplayLevel: 1,
    hasCeiling: false,
    displayLevel: 0,
  }), null)
})

test('un plafond supérieur du volume multi-niveau actif reste affiché', () => {
  assert.equal(horizontalInterfaceRenderKind({
    hasFloor: false,
    hasCeiling: true,
    ceilingDisplayLevel: 2,
    displayLevel: 0,
    ceilingBelongsToCameraVolume: true,
  }), 'ceiling')
})

test('le sol bas du volume multi-niveau actif reste visible', () => {
  assert.equal(horizontalInterfaceRenderKind({
    hasFloor: true,
    floorDisplayLevel: 0,
    floorBelongsToCameraVolume: true,
    hasCeiling: false,
    displayLevel: 1,
  }), 'floor')
})

test('depuis le niveau bas, une interface partagée reste le plafond découpé de la salle basse', () => {
  assert.equal(horizontalInterfaceOpacity({
    displayLevel: 0,
    ceilingDisplayLevel: 0,
    belongsToCameraVolume: false,
    ceilingOpacity: 0.18,
  }), 0.18)
})

test('le plafond courant d un volume multi-niveau actif conserve la coupe', () => {
  assert.equal(horizontalInterfaceOpacity({
    displayLevel: 0,
    ceilingDisplayLevel: 2,
    belongsToCameraVolume: true,
    ceilingOpacity: 0.18,
  }), 0.18)
})
