import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attrOptionKey, handOptionKey, genotypeOptionKey, mutationOptionKey, careerOptionKey, advantageOptionKey,
  originGeoOptionKey, originSocOptionKey, trainingOptionKey, careerWaiveOptionKey,
  isSingleChoiceLockViolation, findSetLockViolations,
} from './wizardOptionKeys.js'

test('formatage des clés — préfixe stable par domaine', () => {
  assert.equal(attrOptionKey('FOR'), 'attr_FOR')
  assert.equal(genotypeOptionKey('HUMAIN'), 'genotype_HUMAIN')
  assert.equal(mutationOptionKey(42), 'mutation_42')
  assert.equal(careerOptionKey('chasseur_primes'), 'career_chasseur_primes')
  assert.equal(advantageOptionKey('adv_077'), 'advantage_adv_077')
})

test('formatage des clés Step4 — origines, formation, dérogation carrière', () => {
  assert.equal(originGeoOptionKey('COTE_EST'), 'origin_geo_COTE_EST')
  assert.equal(originSocOptionKey('OUVRIER'), 'origin_soc_OUVRIER')
  assert.equal(trainingOptionKey('education_scolaire'), 'training_education_scolaire')
  assert.equal(careerWaiveOptionKey('soldat'), 'career_waive_soldat')
  // Distinct de careerOptionKey — deux verrous indépendants sur la même carrière.
  assert.notEqual(careerWaiveOptionKey('soldat'), careerOptionKey('soldat'))
})

test('handOptionKey — L/R verrouillables, Ambidextre jamais', () => {
  assert.equal(handOptionKey('L'), 'hand_L')
  assert.equal(handOptionKey('R'), 'hand_R')
  assert.equal(handOptionKey('A'), null)
  assert.equal(handOptionKey(null), null)
})

test('isSingleChoiceLockViolation — resoumission inchangée toujours acceptée, même verrouillée', () => {
  const lockedKeys = new Set(['genotype_HUMAIN'])
  assert.equal(
    isSingleChoiceLockViolation({ lockedKeys, submittedKey: 'genotype_HUMAIN', persistedKey: 'genotype_HUMAIN' }),
    false,
  )
})

test('isSingleChoiceLockViolation — changement vers une option verrouillée rejeté', () => {
  const lockedKeys = new Set(['genotype_XENOS'])
  assert.equal(
    isSingleChoiceLockViolation({ lockedKeys, submittedKey: 'genotype_XENOS', persistedKey: 'genotype_HUMAIN' }),
    true,
  )
})

test('isSingleChoiceLockViolation — changement depuis une option verrouillée rejeté (même si la cible ne l\'est pas)', () => {
  const lockedKeys = new Set(['genotype_HUMAIN'])
  assert.equal(
    isSingleChoiceLockViolation({ lockedKeys, submittedKey: 'genotype_XENOS', persistedKey: 'genotype_HUMAIN' }),
    true,
  )
})

test('isSingleChoiceLockViolation — changement entre deux options non verrouillées accepté', () => {
  const lockedKeys = new Set(['genotype_AUTRE'])
  assert.equal(
    isSingleChoiceLockViolation({ lockedKeys, submittedKey: 'genotype_XENOS', persistedKey: 'genotype_HUMAIN' }),
    false,
  )
})

test('isSingleChoiceLockViolation — clé null (Ambidextre) jamais elle-même verrouillable', () => {
  const lockedKeys = new Set(['hand_L'])
  // Persisted = 'L' (verrouillé), soumis = 'A' (null) : changement réel depuis une clé verrouillée -> rejet.
  assert.equal(isSingleChoiceLockViolation({ lockedKeys, submittedKey: null, persistedKey: 'hand_L' }), true)
  // Persisted = 'A' (null), soumis = 'A' (null) : aucun changement -> accepté.
  assert.equal(isSingleChoiceLockViolation({ lockedKeys, submittedKey: null, persistedKey: null }), false)
})

test('findSetLockViolations — ajout d\'une option verrouillée absente de l\'ensemble persisté rejeté', () => {
  const lockedKeys = new Set(['career_soldat'])
  const violations = findSetLockViolations({
    lockedKeys,
    submittedKeys: new Set(['career_soldat', 'career_medecin']),
    persistedKeys: new Set(['career_medecin']),
  })
  assert.deepEqual(violations, ['career_soldat'])
})

test('findSetLockViolations — retrait d\'une option verrouillée présente dans l\'ensemble persisté rejeté', () => {
  const lockedKeys = new Set(['career_soldat'])
  const violations = findSetLockViolations({
    lockedKeys,
    submittedKeys: new Set(['career_medecin']),
    persistedKeys: new Set(['career_soldat', 'career_medecin']),
  })
  assert.deepEqual(violations, ['career_soldat'])
})

test('findSetLockViolations — ensemble inchangé toujours accepté, même verrouillé', () => {
  const lockedKeys = new Set(['career_soldat'])
  const violations = findSetLockViolations({
    lockedKeys,
    submittedKeys: new Set(['career_soldat', 'career_medecin']),
    persistedKeys: new Set(['career_soldat', 'career_medecin']),
  })
  assert.deepEqual(violations, [])
})

test('findSetLockViolations — option non verrouillée ajoutée ou retirée librement', () => {
  const lockedKeys = new Set(['career_soldat'])
  const violations = findSetLockViolations({
    lockedKeys,
    submittedKeys: new Set(['career_soldat']),
    persistedKeys: new Set(['career_soldat', 'career_medecin']),
  })
  assert.deepEqual(violations, [])
})
