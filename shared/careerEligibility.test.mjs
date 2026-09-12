// Vérifie evaluateCareerEligibility, en particulier la comparaison études supérieures
// (field = code ref_backgrounds, comparé à ctx.higherEd — bug réel corrigé migration 343 :
// field stockait le nom affiché "Sciences/Sciences humaines" au lieu du code "sciences",
// rendant Érudit/Archéologue et 7 autres métiers inaccessibles quel que soit le choix du joueur).
import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateCareerEligibility } from './careerEligibility.js'

const ERUDIT = {
  education: [{ field: 'sciences', fieldLabel: 'Sciences/Sciences humaines' }],
}

test('éligible quand le code higherEd du joueur correspond au code requis', () => {
  const { eligible, reasons } = evaluateCareerEligibility(ERUDIT, { higherEd: 'sciences' })
  assert.equal(eligible, true)
  assert.deepEqual(reasons, [])
})

test('inéligible sans études supérieures — raison affiche le libellé humain, pas le code', () => {
  const { eligible, reasons } = evaluateCareerEligibility(ERUDIT, { higherEd: null })
  assert.equal(eligible, false)
  assert.deepEqual(reasons, [{ code: 'education', present: false, fields: ['Sciences/Sciences humaines'] }])
})

test('inéligible avec une autre formation — même comparaison par code, pas par nom', () => {
  const { eligible, reasons } = evaluateCareerEligibility(ERUDIT, { higherEd: 'medecine' })
  assert.equal(eligible, false)
  assert.deepEqual(reasons, [{ code: 'education', present: true, fields: ['Sciences/Sciences humaines'] }])
})

test('fieldLabel absent : retombe sur le code brut sans planter', () => {
  const career = { education: [{ field: 'sciences' }] }
  const { reasons } = evaluateCareerEligibility(career, { higherEd: null })
  assert.deepEqual(reasons, [{ code: 'education', present: false, fields: ['sciences'] }])
})
