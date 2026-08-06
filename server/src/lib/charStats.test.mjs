import test from 'node:test'
import assert from 'node:assert/strict'

import { getModDom } from './charStats.js'

test('getModDom — table basse (LdB p.113, tranches de 2 points)', () => {
  assert.equal(getModDom(1), -6)
  assert.equal(getModDom(2), -6)
  assert.equal(getModDom(9), 0)
  assert.equal(getModDom(11), 0)
  assert.equal(getModDom(20), 5)
  assert.equal(getModDom(21), 5)
})

// Extrapolation au-delà de 21 — continuation des mêmes tranches de 2 points (22-23 → +6, 24-25 →
// +7...), vérifiée contre 16 armures RAW réelles (docs/REGLES/REGLEARMURE.md, Exo-Force 25 à 68 —
// PLAN_EXOARMURE.md §2.1 : "la formule utilisée est la même que celle des personnages"). Un bug
// floor/ceil précédent donnait -1 sur tous les écarts impairs (Typhon EXF 30, Condor EXF 42, Mentor
// EXF 50, Odin EXF 60, Vulcain EXF 62, Moloch/Orka EXF 68).
test('getModDom — extrapolation au-delà de 21 (vérifiée contre 16 armures RAW réelles)', () => {
  assert.equal(getModDom(25), 7)   // Armure Explora
  assert.equal(getModDom(30), 10)  // Armure Typhon
  assert.equal(getModDom(35), 12)  // Série A
  assert.equal(getModDom(37), 13)  // Nymph 1-A
  assert.equal(getModDom(42), 16)  // Armure Condor
  assert.equal(getModDom(45), 17)  // Vanguard / Sylph 56 / Vauban / Cougar
  assert.equal(getModDom(50), 20)  // Armure Mentor (échelle humaine)
  assert.equal(getModDom(55), 22)  // Heimdall-Pyrelia
  assert.equal(getModDom(57), 23)  // Armure Ouraken
  assert.equal(getModDom(60), 25)  // Armure Odin (échelle humaine)
  assert.equal(getModDom(62), 26)  // Armure Vulcain (échelle humaine)
  assert.equal(getModDom(68), 29)  // Moloch / Orka (échelle humaine)
})
