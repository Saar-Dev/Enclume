import test from 'node:test'
import assert from 'node:assert/strict'

import { computeOrdinateurStats, computeBlindageIemCost, resolveOrdinateurIntegrityFormula, resolveActiveComputer } from './computerStats.js'

// Exemple RAW littéral (docs/REGLES/REGLE_ORDINATEUR.md p.280) : "un ordinateur de Gén. V et de
// Niveau technologique III, coûte 7 500 sols, et peut être équipé de programmes ayant un niveau
// maximum de 11. Il peut gérer 25 systèmes simultanément et accepte un total de 40 niveaux de
// programmes."
test('computeOrdinateurStats — exemple RAW littéral (Gén. V, NT III)', () => {
  const stats = computeOrdinateurStats({ gen: 5, nt: 3 })
  assert.deepEqual(stats, {
    niveauMaxProgrammes: 11,
    gestionSystemes: 25,
    potentiel: 40,
    cout: 7500,
  })
})

test('computeOrdinateurStats — Gén./NT minimaux (I/I)', () => {
  const stats = computeOrdinateurStats({ gen: 1, nt: 1 })
  assert.deepEqual(stats, {
    niveauMaxProgrammes: 3,
    gestionSystemes: 11,
    potentiel: 12,
    cout: 500,
  })
})

// Ordinateur "secours" typique (Nymph 1-A, docs/REGLES/SEEDEXO.md:1030) : Gén. II, NT II — génération
// différente du principal (Gén. V), donc un profil de stats différent, jamais partagé.
test('computeOrdinateurStats — ordinateur secours distinct du principal (Gén. II, NT II)', () => {
  const stats = computeOrdinateurStats({ gen: 2, nt: 2 })
  assert.deepEqual(stats, {
    niveauMaxProgrammes: 6,
    gestionSystemes: 14,
    potentiel: 18,
    cout: 2000,
  })
})

test('computeOrdinateurStats — gen ou nt absent → null, jamais NaN', () => {
  assert.equal(computeOrdinateurStats({ gen: null, nt: 3 }), null)
  assert.equal(computeOrdinateurStats({ gen: 5, nt: undefined }), null)
  assert.equal(computeOrdinateurStats({}), null)
  assert.equal(computeOrdinateurStats(), null)
})

test('computeOrdinateurStats — gen ou nt à 0 restent des valeurs valides (pas absentes)', () => {
  // 0 est une valeur numérique légitime (ordinateur théorique Gén. 0), distincte de null/undefined —
  // le garde ci-dessus ne doit pas les confondre (`== null` ne matche pas 0).
  const stats = computeOrdinateurStats({ gen: 0, nt: 3 })
  assert.deepEqual(stats, { niveauMaxProgrammes: 6, gestionSystemes: 10, potentiel: 10, cout: 0 })
})

// Exemple RAW littéral (docs/REGLES/REGLE_ORDINATEUR.md p.280) : "un ordinateur ayant un blindage IEM
// de niveau 5 (bonus de +5 au Test de panne) va coûter 5 000 sols supplémentaires."
test('computeBlindageIemCost — exemple RAW littéral (niveau 5 → 5000 sols)', () => {
  assert.equal(computeBlindageIemCost(5), 5000)
})

test('computeBlindageIemCost — niveau absent → null', () => {
  assert.equal(computeBlindageIemCost(null), null)
  assert.equal(computeBlindageIemCost(undefined), null)
})

test('computeBlindageIemCost — niveau 0 reste une valeur valide (pas absente)', () => {
  assert.equal(computeBlindageIemCost(0), 0)
})

// Table RAW littérale (docs/REGLES/REGLE_ORDINATEUR.md:91-93) — bornes exactes des 3 paliers.
test('resolveOrdinateurIntegrityFormula — bornes exactes des 3 paliers RAW', () => {
  assert.equal(resolveOrdinateurIntegrityFormula(1), '2d6+3')
  assert.equal(resolveOrdinateurIntegrityFormula(2), '2d6+3')
  assert.equal(resolveOrdinateurIntegrityFormula(3), '2d6+8')
  assert.equal(resolveOrdinateurIntegrityFormula(8), '2d6+8')
  assert.equal(resolveOrdinateurIntegrityFormula(9), '3d6+7')
  assert.equal(resolveOrdinateurIntegrityFormula(10), '3d6+7')
})

test('resolveOrdinateurIntegrityFormula — hors plage RAW (0 ou 11+) : erreur explicite, jamais un repli silencieux', () => {
  assert.throws(() => resolveOrdinateurIntegrityFormula(0), /hors plage RAW/)
  assert.throws(() => resolveOrdinateurIntegrityFormula(11), /hors plage RAW/)
})

// resolveActiveComputer — précision Saar 2026-08-21 : le secours ne fonctionne JAMAIS en parallèle du
// principal, il prend le relais uniquement quand le principal est HS (Intégrité courante <= 0).
test('resolveActiveComputer — principal fonctionnel : c\'est lui l\'actif, jamais le secours en parallèle', () => {
  const principal = { role: 'principal', integrite_current: 10 }
  const secours = { role: 'secours', integrite_current: 8 }
  assert.equal(resolveActiveComputer([principal, secours]), principal)
})

test('resolveActiveComputer — principal HS (Intégrité <= 0) : le secours prend le relais', () => {
  const principal = { role: 'principal', integrite_current: 0 }
  const secours = { role: 'secours', integrite_current: 8 }
  assert.equal(resolveActiveComputer([principal, secours]), secours)
})

test('resolveActiveComputer — principal ET secours HS : aucun ordinateur actif', () => {
  const principal = { role: 'principal', integrite_current: 0 }
  const secours = { role: 'secours', integrite_current: -3 }
  assert.equal(resolveActiveComputer([principal, secours]), null)
})

test('resolveActiveComputer — un seul ordinateur (principal seul, cas le plus fréquent, 12 armures/16)', () => {
  const principal = { role: 'principal', integrite_current: 15 }
  assert.equal(resolveActiveComputer([principal]), principal)
})

test('resolveActiveComputer — aucun ordinateur : null', () => {
  assert.equal(resolveActiveComputer([]), null)
  assert.equal(resolveActiveComputer(), null)
})

test('resolveActiveComputer — principal HS sans secours du tout : null (pas de relais possible)', () => {
  const principal = { role: 'principal', integrite_current: 0 }
  assert.equal(resolveActiveComputer([principal]), null)
})
