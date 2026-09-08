import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SIZE_CATEGORIES, TAILLE_CM_BREAKPOINTS, HUMANOID_SIZE_CLAMP_CM, EXO_CATEGORY_HEIGHT_CM,
  sizeCategoryFromCm, resolveSizeCategoryFrom,
} from './sizeCategory.js'

// Lancement : node --test shared/sizeCategory.test.mjs

// ─── Cohérence de l'énumération ─────────────────────────────────────────────

test('SIZE_CATEGORIES - 8 paliers ordonnés, couverts par les breakpoints', () => {
  assert.equal(SIZE_CATEGORIES.length, 8)
  assert.deepEqual(TAILLE_CM_BREAKPOINTS.map(b => b.category), SIZE_CATEGORIES)
  assert.equal(TAILLE_CM_BREAKPOINTS.at(-1).maxCm, Infinity)
})

test('EXO_CATEGORY_HEIGHT_CM - 9 catégories, chacune tombe sur un palier connu', () => {
  const keys = Object.keys(EXO_CATEGORY_HEIGHT_CM)
  assert.equal(keys.length, 9)
  for (const k of keys) {
    const { category } = sizeCategoryFromCm(EXO_CATEGORY_HEIGHT_CM[k])
    assert.ok(SIZE_CATEGORIES.includes(category), `${k} -> ${category}`)
  }
})

// ─── sizeCategoryFromCm ─────────────────────────────────────────────────────

test('sizeCategoryFromCm - repères RAW tombent dans le bon palier', () => {
  assert.equal(sizeCategoryFromCm(30).category, 'minuscule')
  assert.equal(sizeCategoryFromCm(50).category, 'tres_petite')
  assert.equal(sizeCategoryFromCm(100).category, 'petite')
  assert.equal(sizeCategoryFromCm(170).category, 'moyenne')
  assert.equal(sizeCategoryFromCm(300).category, 'grande')
  assert.equal(sizeCategoryFromCm(500).category, 'tres_grande')
  assert.equal(sizeCategoryFromCm(700).category, 'enorme')
  assert.equal(sizeCategoryFromCm(1000).category, 'gigantesque')
})

test('sizeCategoryFromCm - frontières géométriques exactes (borne incluse)', () => {
  assert.equal(sizeCategoryFromCm(39).category, 'minuscule')
  assert.equal(sizeCategoryFromCm(40).category, 'tres_petite')
  assert.equal(sizeCategoryFromCm(130).category, 'petite')
  assert.equal(sizeCategoryFromCm(131).category, 'moyenne')
  assert.equal(sizeCategoryFromCm(837).category, 'enorme')
  assert.equal(sizeCategoryFromCm(838).category, 'gigantesque')
})

test('sizeCategoryFromCm - clamp mord et le signale', () => {
  const bas = sizeCategoryFromCm(80, HUMANOID_SIZE_CLAMP_CM)
  assert.equal(bas.category, 'petite') // 80 -> clamp 120 -> petite
  assert.equal(bas.cm, 120)
  assert.equal(bas.clamped, true)

  const haut = sizeCategoryFromCm(500, HUMANOID_SIZE_CLAMP_CM)
  assert.equal(haut.category, 'grande') // 500 -> clamp 300 -> grande
  assert.equal(haut.cm, 300)
  assert.equal(haut.clamped, true)

  const dedans = sizeCategoryFromCm(175, HUMANOID_SIZE_CLAMP_CM)
  assert.equal(dedans.clamped, false)
  assert.equal(dedans.cm, 175)
})

test('sizeCategoryFromCm - entrée non finie -> category null, jamais un throw', () => {
  assert.deepEqual(sizeCategoryFromCm(null), { category: null, cm: null, clamped: false })
  assert.deepEqual(sizeCategoryFromCm(undefined), { category: null, cm: null, clamped: false })
  assert.deepEqual(sizeCategoryFromCm(NaN), { category: null, cm: null, clamped: false })
})

// ─── resolveSizeCategoryFrom — cascade ──────────────────────────────────────

test('cascade - size_category explicite gagne sur tout, quel que soit le type', () => {
  const r = resolveSizeCategoryFrom({ type: 'pj', sizeCategory: 'enorme', heightM: 1.8 })
  assert.deepEqual(r, { cm: null, category: 'enorme', source: 'explicit' })
})

test('cascade - explicite ignoré si valeur hors énumération -> on dérive', () => {
  const r = resolveSizeCategoryFrom({ type: 'pj', sizeCategory: 'colossale', heightM: 1.8 })
  assert.equal(r.category, 'moyenne')
  assert.equal(r.source, 'derived')
})

test('cascade - humanoïde dérivé depuis la taille en mètres', () => {
  assert.equal(resolveSizeCategoryFrom({ type: 'pj', heightM: 1.8 }).category, 'moyenne')
  assert.equal(resolveSizeCategoryFrom({ type: 'pnj', heightM: 1.25 }).category, 'petite')
  const nain = resolveSizeCategoryFrom({ type: 'pj', heightM: 1.25 })
  assert.equal(nain.source, 'derived')
  assert.equal(nain.cm, 125)
})

test('cascade - humanoïde hors gabarit -> derived-clamped', () => {
  const geant = resolveSizeCategoryFrom({ type: 'pnj', heightM: 5 })
  assert.equal(geant.category, 'grande')
  assert.equal(geant.cm, 300)
  assert.equal(geant.source, 'derived-clamped')
})

test('cascade - drone dérivé depuis taille cm, sans clamp', () => {
  assert.equal(resolveSizeCategoryFrom({ type: 'drone', droneTailleCm: 40 }).category, 'tres_petite')
  const petit = resolveSizeCategoryFrom({ type: 'drone', droneTailleCm: 90 })
  assert.equal(petit.category, 'petite')
  assert.equal(petit.source, 'derived')
})

test('cascade - exo dérivé depuis la catégorie', () => {
  assert.equal(resolveSizeCategoryFrom({ type: 'exo', exoCategory: 'exo-alpha' }).category, 'moyenne')
  assert.equal(resolveSizeCategoryFrom({ type: 'exo', exoCategory: 'exo-3' }).category, 'grande')
  assert.equal(resolveSizeCategoryFrom({ type: 'exo', exoCategory: 'exo-6' }).category, 'tres_grande')
})

test('cascade - donnée absente -> moyenne / default', () => {
  assert.deepEqual(resolveSizeCategoryFrom({ type: 'pj' }), { cm: null, category: 'moyenne', source: 'default' })
  assert.deepEqual(resolveSizeCategoryFrom({ type: 'drone' }), { cm: null, category: 'moyenne', source: 'default' })
  assert.deepEqual(resolveSizeCategoryFrom({ type: 'exo', exoCategory: null }), { cm: null, category: 'moyenne', source: 'default' })
  assert.deepEqual(resolveSizeCategoryFrom({}), { cm: null, category: 'moyenne', source: 'default' })
})

test('cascade - type inconnu sans explicite -> default', () => {
  assert.equal(resolveSizeCategoryFrom({ type: 'vehicule', heightM: 3 }).source, 'default')
})
