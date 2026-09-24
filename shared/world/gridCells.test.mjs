import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cellKey,
  cellOfPoint,
  cellsCrossedBySegment,
  createSegmentCellPredicate,
} from './gridCells.js'

const keys = cells => cells.map(cell => cellKey(cell))
const p = (x, z, y = 0) => ({ x, y, z })

test('cellOfPoint : la case est (floor(x), floor(z)), négatifs et frontières compris', () => {
  assert.deepEqual(cellOfPoint(p(0.5, 0.5)), { x: 0, z: 0 })
  assert.deepEqual(cellOfPoint(p(2.999, 3.0)), { x: 2, z: 3 })
  assert.deepEqual(cellOfPoint(p(-0.1, -1.0)), { x: -1, z: -1 })
})

test('un segment contenu dans une seule case ne traverse que cette case', () => {
  const cells = cellsCrossedBySegment(p(1.2, 2.2), p(1.8, 2.7))
  assert.deepEqual(keys(cells), ['1:2'])
  assert.equal(cells[0].enterRatio, 0)
  assert.equal(cells[0].exitRatio, 1)
})

test('un segment aligné sur une rangée traverse chaque case dans l’ordre du parcours', () => {
  const cells = cellsCrossedBySegment(p(0.5, 0.5), p(3.5, 0.5))
  assert.deepEqual(keys(cells), ['0:0', '1:0', '2:0', '3:0'])
  assert.ok(Math.abs(cells[1].enterRatio - 1 / 6) < 1e-9)
  assert.ok(Math.abs(cells[1].exitRatio - 3 / 6) < 1e-9)
})

test('un segment aligné sur une colonne traverse chaque case, vers les z décroissants aussi', () => {
  assert.deepEqual(keys(cellsCrossedBySegment(p(0.5, 0.5), p(0.5, 2.5))), ['0:0', '0:1', '0:2'])
  assert.deepEqual(keys(cellsCrossedBySegment(p(0.5, 2.5), p(0.5, 0.5))), ['0:2', '0:1', '0:0'])
})

test('une pente quelconque franchit les frontières dans l’ordre exact', () => {
  // z = 0.25 + (x - 0.5) / 3 : frontières x=1 (t=1/6), x=2 (t=1/2), z=1 (t=3/4), x=3 (t=5/6).
  const cells = cellsCrossedBySegment(p(0.5, 0.25), p(3.5, 1.25))
  assert.deepEqual(keys(cells), ['0:0', '1:0', '2:0', '2:1', '3:1'])
})

test('un passage par un coin compte les deux cases qui le touchent (supercover)', () => {
  const cells = cellsCrossedBySegment(p(0.5, 0.5), p(2.5, 2.5))
  assert.deepEqual(new Set(keys(cells)), new Set(['0:0', '1:0', '0:1', '1:1', '2:1', '1:2', '2:2']))
  // Le coin (1,1) est atteint au quart du segment, et le coin (2,2) aux trois quarts.
  const firstSide = cells.find(cell => cellKey(cell) === '1:0')
  assert.ok(Math.abs(firstSide.enterRatio - 0.25) < 1e-9)
})

test('le sens du segment ne change pas l’ensemble des cases traversées', () => {
  const forward = cellsCrossedBySegment(p(0.5, 0.25), p(3.5, 1.25))
  const backward = cellsCrossedBySegment(p(3.5, 1.25), p(0.5, 0.25))
  assert.deepEqual(new Set(keys(forward)), new Set(keys(backward)))
})

test('un segment qui finit exactement sur une frontière effleure la case voisine', () => {
  assert.deepEqual(keys(cellsCrossedBySegment(p(0.5, 0.5), p(2.0, 0.5))), ['0:0', '1:0', '2:0'])
})

test('un segment 3D qui monte porte l’altitude dans ses rapports entrée/sortie', () => {
  const cells = cellsCrossedBySegment(p(0.5, 0.5, 0), p(2.5, 0.5, 4))
  assert.equal(cells.length, 3)
  assert.equal(cells[0].enterRatio, 0)
  assert.equal(cells.at(-1).exitRatio, 1)
})

test('createSegmentCellPredicate : case traversée ET hauteur de ligne compatible avec le corps', () => {
  const from = p(0.5, 0.5, 1.0)
  const to = p(3.5, 0.5, 1.0)
  const onFloor = createSegmentCellPredicate(from, to, { bodyHeight: 1.2 })
  assert.equal(onFloor({ point: p(2.5, 0.5, 0.125) }), true, 'dalle au sol, ligne à hauteur du corps')
  assert.equal(onFloor({ point: p(2.5, 1.5, 0.125) }), false, 'case voisine non traversée')
  assert.equal(onFloor({ point: p(2.5, 0.5, 2.75) }), false, 'étage au-dessus : la ligne passe sous ses pieds')
})

test('createSegmentCellPredicate : deux étages superposés, la ligne haute ne concerne que celui d’en haut', () => {
  const from = p(0.5, 0.5, 3.0)
  const to = p(3.5, 0.5, 3.0)
  const predicate = createSegmentCellPredicate(from, to, { bodyHeight: 1.2 })
  assert.equal(predicate({ point: p(1.5, 0.5, 2.75) }), true)
  assert.equal(predicate({ point: p(1.5, 0.5, 0.125) }), false)
})

test('createSegmentCellPredicate refuse une hauteur de corps invalide', () => {
  assert.throws(() => createSegmentCellPredicate(p(0, 0), p(1, 0), { bodyHeight: 0 }), RangeError)
  assert.throws(() => createSegmentCellPredicate(p(0, 0), p(1, 0)), RangeError)
})

test('un départ exactement sur une frontière, vers les x décroissants, effleure la case de départ puis entre dans la voisine', () => {
  assert.deepEqual(keys(cellsCrossedBySegment(p(2.0, 0.5), p(0.5, 0.5))), ['2:0', '1:0', '0:0'])
})
