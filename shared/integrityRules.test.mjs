import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INTEGRITY_TIERS,
  getIntegrityTier,
  getIntegrityModifier,
  isIntegrityUsable,
  QUALITY_TABLE,
  applyTemporaryLoss,
  applyRepair,
  interpretPanneOutcome,
} from './integrityRules.js'

// Lancement manuel : node --test shared/integrityRules.test.mjs
// Patron : shared/polarisTestResolution.test.mjs. Module pur — aucune base.

// ── INTEGRITY_TIERS — structure ──────────────────────────────────────────────
test('INTEGRITY_TIERS — 6 paliers, clés uniques, ordre meilleur → pire', () => {
  assert.equal(INTEGRITY_TIERS.length, 6)
  const keys = INTEGRITY_TIERS.map((t) => t.key)
  assert.deepEqual(keys, ['excellent', 'bon', 'moyen', 'usage', 'endommage', 'horsdusage'])
  assert.equal(new Set(keys).size, 6)
})

test('INTEGRITY_TIERS — aucun trou ni recouvrement entre paliers consécutifs', () => {
  const lo = (v) => (v === null ? -Infinity : v)
  const hi = (v) => (v === null ? Infinity : v)
  const sorted = [...INTEGRITY_TIERS].sort((a, b) => lo(a.min) - lo(b.min))
  for (let i = 0; i < sorted.length - 1; i++) {
    assert.equal(
      hi(sorted[i].max) + 1,
      lo(sorted[i + 1].min),
      `trou/recouvrement entre ${JSON.stringify(sorted[i])} et ${JSON.stringify(sorted[i + 1])}`,
    )
  }
})

test('getIntegrityTier — chaque entier 0→25 tombe sur exactement un palier, avec la bonne clé', () => {
  const expected = {
    excellent: [21, 22, 23, 24, 25],
    bon: [16, 17, 18, 19, 20],
    moyen: [11, 12, 13, 14, 15],
    usage: [6, 7, 8, 9, 10],
    endommage: [1, 2, 3, 4, 5],
    horsdusage: [0],
  }
  for (const [key, values] of Object.entries(expected)) {
    for (const v of values) {
      const tier = getIntegrityTier(v)
      assert.ok(tier, `ITG ${v} : un palier`)
      assert.equal(tier.key, key, `ITG ${v} → ${key}`)
    }
  }
})

test('getIntegrityTier — bornes ouvertes défensives (hors plage CHECK) : saturation', () => {
  assert.equal(getIntegrityTier(26).key, 'excellent') // > 25 impossible en base — sature en haut
  assert.equal(getIntegrityTier(-3).key, 'horsdusage') // RAW « 0 et − »
})

test('getIntegrityTier — entrée non entière / absente → null', () => {
  assert.equal(getIntegrityTier(null), null)
  assert.equal(getIntegrityTier(undefined), null)
  assert.equal(getIntegrityTier(12.5), null)
  assert.equal(getIntegrityTier('12'), null)
  assert.equal(getIntegrityTier(NaN), null)
})

// ── getIntegrityModifier (MANUEL §3.3) ───────────────────────────────────────
test('getIntegrityModifier — +2 / 0 / -3 / -5 selon le palier, null pour hors d\'usage', () => {
  assert.equal(getIntegrityModifier(25), 2)
  assert.equal(getIntegrityModifier(21), 2)
  assert.equal(getIntegrityModifier(20), 0)
  assert.equal(getIntegrityModifier(16), 0)
  assert.equal(getIntegrityModifier(15), 0)
  assert.equal(getIntegrityModifier(11), 0)
  assert.equal(getIntegrityModifier(10), -3)
  assert.equal(getIntegrityModifier(6), -3)
  assert.equal(getIntegrityModifier(5), -5)
  assert.equal(getIntegrityModifier(1), -5)
  assert.equal(getIntegrityModifier(0), null) // hors d'usage — jamais 0
})

test('getIntegrityModifier — entrée invalide → null', () => {
  assert.equal(getIntegrityModifier(null), null)
  assert.equal(getIntegrityModifier(12.5), null)
})

// ── isIntegrityUsable (RAW « 0 et − : le matériel ne fonctionne plus ») ──────
test('isIntegrityUsable — seul un entier ≤ 0 est inutilisable', () => {
  assert.equal(isIntegrityUsable(0), false)
  assert.equal(isIntegrityUsable(-2), false)
  assert.equal(isIntegrityUsable(1), true)
  assert.equal(isIntegrityUsable(25), true)
  assert.equal(isIntegrityUsable(null), true) // objet non suivi — toujours utilisable
  assert.equal(isIntegrityUsable(undefined), true)
  assert.equal(isIntegrityUsable(12.5), true)
})

// ── QUALITY_TABLE (MANUEL §3.1) ──────────────────────────────────────────────
test('QUALITY_TABLE — exactement les 5 clés du CHECK migration 329', () => {
  assert.deepEqual(
    Object.keys(QUALITY_TABLE).sort(),
    ['bas_cout', 'bon_marche', 'bonne_qualite', 'excellente', 'standard'],
  )
})

test('QUALITY_TABLE — itgMax RAW (5/10/15/20/25) + occasionFormula = forme de dé valide', () => {
  const expectedMax = { bas_cout: 5, bon_marche: 10, standard: 15, bonne_qualite: 20, excellente: 25 }
  const DICE = /^\d*D\d+([+-]\d+)?$/i
  for (const [key, row] of Object.entries(QUALITY_TABLE)) {
    assert.equal(row.itgMax, expectedMax[key], `${key}.itgMax`)
    assert.match(row.occasionFormula, DICE, `${key}.occasionFormula`)
  }
  assert.equal(QUALITY_TABLE.bas_cout.occasionFormula, '1D4+1')
  assert.equal(QUALITY_TABLE.bonne_qualite.occasionFormula, '2D6+6')
  assert.equal(QUALITY_TABLE.excellente.occasionFormula, '3D6+5')
})

// ── applyTemporaryLoss (MANUEL §3.4 — cas PLAN §4/M4) ────────────────────────
test('applyTemporaryLoss — perte < 5 sans franchir de palier : 0 définitif', () => {
  assert.deepEqual(applyTemporaryLoss(18, 20, 2), { newCurrent: 16, newMax: 20, definitiveLoss: 0, tiersCrossed: 0 })
})

test('applyTemporaryLoss — perte franchissant 1 palier, perte < 5 : −1 définitif', () => {
  assert.deepEqual(applyTemporaryLoss(11, 15, 2), { newCurrent: 9, newMax: 14, definitiveLoss: 1, tiersCrossed: 1 })
})

test('applyTemporaryLoss — perte ≥ 5 franchissant 1 palier : −1 (max(1,1))', () => {
  assert.deepEqual(applyTemporaryLoss(20, 20, 5), { newCurrent: 15, newMax: 19, definitiveLoss: 1, tiersCrossed: 1 })
})

test('applyTemporaryLoss — exemple MANUEL §3.4 : 18 perd 10 → 8, deux paliers (−2, pas −3 = somme)', () => {
  assert.deepEqual(applyTemporaryLoss(18, 18, 10), { newCurrent: 8, newMax: 16, definitiveLoss: 2, tiersCrossed: 2 })
})

test('applyTemporaryLoss — −1D6 critique = 6 franchissant un palier : −1 définitif', () => {
  assert.deepEqual(applyTemporaryLoss(10, 10, 6), { newCurrent: 4, newMax: 9, definitiveLoss: 1, tiersCrossed: 1 })
})

test('applyTemporaryLoss — destruction (25 perd 25) : 5 paliers, newMax plafonné, courante 0', () => {
  assert.deepEqual(applyTemporaryLoss(25, 25, 25), { newCurrent: 0, newMax: 20, definitiveLoss: 5, tiersCrossed: 5 })
})

test('applyTemporaryLoss — plancher newMax = 1 (CHECK L0)', () => {
  assert.deepEqual(applyTemporaryLoss(1, 1, 1), { newCurrent: 0, newMax: 1, definitiveLoss: 1, tiersCrossed: 1 })
})

test('applyTemporaryLoss — perte nulle ou négative : no-op (pas une réparation)', () => {
  assert.deepEqual(applyTemporaryLoss(15, 20, 0), { newCurrent: 15, newMax: 20, definitiveLoss: 0, tiersCrossed: 0 })
  assert.deepEqual(applyTemporaryLoss(15, 20, -5), { newCurrent: 15, newMax: 20, definitiveLoss: 0, tiersCrossed: 0 })
})

test('applyTemporaryLoss — clamp courante ≤ max (défensif : entrée courante > max, interdite par le CHECK L0)', () => {
  // Aucune perte, mais courante incohérente : la règle MANUEL §3.4 (« la courante ne dépasse
  // jamais le max ») ramène la courante au max.
  assert.deepEqual(applyTemporaryLoss(18, 15, 0), { newCurrent: 15, newMax: 15, definitiveLoss: 0, tiersCrossed: 0 })
})

// ── applyRepair (RAW « Réparation du matériel ») ─────────────────────────────
test('applyRepair — ajoute les points, jamais au-dessus du max', () => {
  assert.equal(applyRepair(10, 20, 5), 15)
  assert.equal(applyRepair(18, 20, 5), 20) // plafonné
  assert.equal(applyRepair(0, 20, 8), 8) // réparation depuis « hors d'usage »
})

test('applyRepair — points négatifs ignorés (la Catastrophe -1 max est ailleurs)', () => {
  assert.equal(applyRepair(10, 20, -3), 10)
})

// ── interpretPanneOutcome (MANUEL §4.1) ─────────────────────────────────────
test('interpretPanneOutcome — lit uniquement isSuccess et catastropheRisk', () => {
  assert.equal(interpretPanneOutcome({ isSuccess: true }), 'ok')
  assert.equal(interpretPanneOutcome({ isSuccess: false, catastropheRisk: false }), 'simple')
  assert.equal(interpretPanneOutcome({ isSuccess: false, catastropheRisk: true }), 'critical')
  // isSuccess prime (combinaison impossible depuis resolvePolarisTest, mais contrat défensif)
  assert.equal(interpretPanneOutcome({ isSuccess: true, catastropheRisk: true }), 'ok')
})
