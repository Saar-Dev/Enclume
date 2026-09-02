import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_LOCALE, REF_TRANSLATABLE, resolveRefField, localizeRef, localizeRefRows,
} from './refI18n.js'

// Tests purs — aucune base. Lancement : node --test server/src/lib/refI18n.test.mjs

test('DEFAULT_LOCALE est le français', () => {
  assert.equal(DEFAULT_LOCALE, 'fr')
})

test('REF_TRANSLATABLE couvre exactement les 10 tables ref_* du Lot 5', () => {
  assert.deepEqual(Object.keys(REF_TRANSLATABLE).sort(), [
    'ref_advantages', 'ref_backgrounds', 'ref_career_random_benefits', 'ref_careers',
    'ref_equipment', 'ref_genotypes', 'ref_mutation_subtypes', 'ref_mutations',
    'ref_setbacks', 'ref_skills',
  ])
})

test('resolveRefField — locale par défaut : renvoie la colonne d\'origine (ignore _i18n)', () => {
  const row = { label: 'Humain', label_i18n: { en: 'Human' } }
  assert.equal(resolveRefField('ref_genotypes', row, 'label'), 'Humain')
})

test('resolveRefField — autre langue présente dans _i18n', () => {
  const row = { label: 'Humain', label_i18n: { en: 'Human' } }
  assert.equal(resolveRefField('ref_genotypes', row, 'label', 'en'), 'Human')
})

test('resolveRefField — autre langue absente : repli sur la colonne d\'origine', () => {
  const row = { label: 'Humain', label_i18n: {} }
  assert.equal(resolveRefField('ref_genotypes', row, 'label', 'de'), 'Humain')
})

test('resolveRefField — row absent : null', () => {
  assert.equal(resolveRefField('ref_genotypes', null, 'label'), null)
  assert.equal(resolveRefField('ref_genotypes', undefined, 'label', 'en'), null)
})

test('resolveRefField — champ vide reste vide (pas de repli abusif)', () => {
  assert.equal(resolveRefField('ref_equipment', { description: '', description_i18n: {} }, 'description'), '')
})

test('resolveRefField — champ null renvoie null', () => {
  assert.equal(resolveRefField('ref_backgrounds', { description: null, description_i18n: {} }, 'description'), null)
})

test('localizeRef — fr : retire les colonnes _i18n, valeurs inchangées', () => {
  const row = {
    id: 1, label: 'Humain', description: 'Humain normal.', mod_for: 0,
    label_i18n: { en: 'Human' }, description_i18n: {},
  }
  assert.deepEqual(localizeRef('ref_genotypes', row), {
    id: 1, label: 'Humain', description: 'Humain normal.', mod_for: 0,
  })
})

test('localizeRef — autre langue : résout et retire les _i18n', () => {
  const row = { id: 1, label: 'Humain', label_i18n: { en: 'Human' }, description: 'x', description_i18n: {} }
  assert.deepEqual(localizeRef('ref_genotypes', row, 'en'), { id: 1, label: 'Human', description: 'x' })
})

test('localizeRef — table hors REF_TRANSLATABLE : retire seulement les _i18n', () => {
  assert.deepEqual(localizeRef('ref_inconnue', { a: 1, a_i18n: {} }), { a: 1 })
})

test('localizeRef — row absent : passthrough', () => {
  assert.equal(localizeRef('ref_genotypes', null), null)
  assert.equal(localizeRef('ref_genotypes', undefined), undefined)
})

test('localizeRef — special_trait (ref_mutation_subtypes) fait partie des champs résolus', () => {
  const row = {
    name: 'Félin', description: 'd', special_trait: 'Se faufiler',
    name_i18n: {}, description_i18n: {}, special_trait_i18n: {},
  }
  assert.deepEqual(localizeRef('ref_mutation_subtypes', row), {
    name: 'Félin', description: 'd', special_trait: 'Se faufiler',
  })
})

test('localizeRefRows — applique localizeRef à chaque ligne', () => {
  const rows = [
    { label: 'A', label_i18n: {}, description: null, description_i18n: {} },
    { label: 'B', label_i18n: { en: 'Bee' }, description: 'd', description_i18n: {} },
  ]
  assert.deepEqual(localizeRefRows('ref_genotypes', rows), [
    { label: 'A', description: null },
    { label: 'B', description: 'd' },
  ])
})
