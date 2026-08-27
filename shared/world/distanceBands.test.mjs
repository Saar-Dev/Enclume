import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeDistanceBands, resolveDistanceBand } from './distanceBands.js'

// Table de dégression grenades, RAW (docs/REGLES/REGLES_ARMES_SPECIALES.md) — cas réel du domaine,
// pas des nombres abstraits.
const GRENADE_BANDS = normalizeDistanceBands([
  { maxDistanceM: 2, damageDice: '+1D10', savePossible: false },
  { maxDistanceM: 5, damageDice: '+0', savePossible: false },
  { maxDistanceM: 10, damageDice: '-1D10', savePossible: false },
  { maxDistanceM: 20, damageDice: '-2D10', savePossible: true, saveBonus: 0 },
  { maxDistanceM: 30, damageDice: '-3D10', savePossible: true, saveBonus: 5 },
])

test('resolveDistanceBand — sélectionne le premier palier dont la borne couvre la distance', () => {
  assert.equal(resolveDistanceBand(0, GRENADE_BANDS).damageDice, '+1D10')
  assert.equal(resolveDistanceBand(2, GRENADE_BANDS).damageDice, '+1D10', 'borne inclusive')
  assert.equal(resolveDistanceBand(2.01, GRENADE_BANDS).damageDice, '+0')
  assert.equal(resolveDistanceBand(15, GRENADE_BANDS).damageDice, '-2D10')
  assert.equal(resolveDistanceBand(15, GRENADE_BANDS).savePossible, true)
})

test('resolveDistanceBand — au-delà de la dernière borne, le dernier palier (portée extrême) s’applique toujours', () => {
  const band = resolveDistanceBand(1000, GRENADE_BANDS)
  assert.equal(band.damageDice, '-3D10')
  assert.equal(band.saveBonus, 5)
})

test('resolveDistanceBand — refuse une distance négative ou non numérique', () => {
  assert.throws(() => resolveDistanceBand(-1, GRENADE_BANDS), /positif ou nul/)
  assert.throws(() => resolveDistanceBand(NaN, GRENADE_BANDS), /nombre fini/)
})

test('resolveDistanceBand — refuse une table vide ou absente', () => {
  assert.throws(() => resolveDistanceBand(5, []), /normalizeDistanceBands/)
  assert.throws(() => resolveDistanceBand(5, null), /normalizeDistanceBands/)
})

test('resolveDistanceBand — refuse un tableau construit à la main, jamais passé par normalizeDistanceBands', () => {
  // Array#find retournerait la première entrée dans l'ordre du tableau, pas la plus proche : sur des
  // paliers non triés ça donnerait un résultat FAUX en silence — ce garde doit le refuser net plutôt
  // que de laisser passer un mauvais calcul de dégression.
  const handBuilt = [{ maxDistanceM: 10 }, { maxDistanceM: 5 }] // volontairement non trié
  assert.throws(() => resolveDistanceBand(3, handBuilt), /normalizeDistanceBands/)
})

test('normalizeDistanceBands — exige un tri strictement croissant, ne le corrige jamais silencieusement', () => {
  assert.throws(
    () => normalizeDistanceBands([{ maxDistanceM: 10 }, { maxDistanceM: 5 }]),
    /strictement croissant/,
  )
  assert.throws(
    () => normalizeDistanceBands([{ maxDistanceM: 10 }, { maxDistanceM: 10 }]),
    /strictement croissant/,
    'deux paliers à la même borne sont une table ambiguë, pas juste un doublon inoffensif',
  )
})

test('normalizeDistanceBands — refuse une borne nulle, négative ou non numérique', () => {
  assert.throws(() => normalizeDistanceBands([{ maxDistanceM: 0 }]), /strictement positif/)
  assert.throws(() => normalizeDistanceBands([{ maxDistanceM: -5 }]), /strictement positif/)
  assert.throws(() => normalizeDistanceBands([{ maxDistanceM: 'loin' }]), /nombre fini/)
})

test('normalizeDistanceBands — refuse un tableau vide ou une entrée qui n’est pas un objet', () => {
  assert.throws(() => normalizeDistanceBands([]), /tableau non vide/)
  assert.throws(() => normalizeDistanceBands([5]), /doit être un objet/)
})

test('normalizeDistanceBands — fige le résultat (immuable, jamais retouché après coup)', () => {
  assert.ok(Object.isFrozen(GRENADE_BANDS))
  assert.ok(Object.isFrozen(GRENADE_BANDS[0]))
})
