import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTestOutcome, applyCriticalFailReroll, getCriticalSuccessBonus, applyCriticalSuccessBonus, getMrModifier, MR_TABLE } from './polarisTestResolution.js'

// Lancement manuel (aucun script npm test dans le projet) :
//   node --test shared/polarisTestResolution.test.mjs

test('marge de réussite = roll direct (pas seuil-roll)', () => {
  const r = resolveTestOutcome(3, 10)
  assert.equal(r.isSuccess, true)
  assert.equal(r.mr, 3)
})

test('marge d\'échec = roll - seuil (inchangé)', () => {
  const r = resolveTestOutcome(12, 11)
  assert.equal(r.isSuccess, false)
  assert.equal(r.mr, -1)
})

test('égalité au Seuil = réussite critique, marge = seuil', () => {
  const r = resolveTestOutcome(10, 10)
  assert.equal(r.isSuccess, true)
  assert.equal(r.isCriticalSuccess, true)
  assert.equal(r.mr, 10)
})

test('réussite critique dépend du Seuil visé, jamais fixée à roll===1', () => {
  assert.equal(resolveTestOutcome(1, 10).isCriticalSuccess, false)
  assert.equal(resolveTestOutcome(1, 1).isCriticalSuccess, true)
  assert.equal(resolveTestOutcome(14, 14).isCriticalSuccess, true)
})

test('échec critique = roll===20 exactement, jamais une Catastrophe automatique', () => {
  const r = resolveTestOutcome(20, 10)
  assert.equal(r.isSuccess, false)
  assert.equal(r.isCriticalFail, true)
  assert.equal(r.catastropheRisk, false) // mr=-10, pas encore ≥15 avant le retest
})

test('Seuil >= 20 : aucun échec critique possible, un 20 devient réussite critique', () => {
  const r20 = resolveTestOutcome(20, 20)
  assert.equal(r20.isSuccess, true)
  assert.equal(r20.isCriticalFail, false)
  assert.equal(r20.isCriticalSuccess, true)

  const r25 = resolveTestOutcome(20, 25)
  assert.equal(r25.isSuccess, true)
  assert.equal(r25.isCriticalFail, false)
  assert.equal(r25.isCriticalSuccess, true)

  const r25NonCrit = resolveTestOutcome(15, 25)
  assert.equal(r25NonCrit.isSuccess, true)
  assert.equal(r25NonCrit.isCriticalSuccess, false)
})

test('catastropheRisk seulement en échec, à partir de marge -15', () => {
  assert.equal(resolveTestOutcome(24, 10).mr, -14)
  assert.equal(resolveTestOutcome(24, 10).catastropheRisk, false)
  assert.equal(resolveTestOutcome(25, 10).mr, -15)
  assert.equal(resolveTestOutcome(25, 10).catastropheRisk, true)
  // Jamais côté réussite, quelle que soit la marge.
  assert.equal(resolveTestOutcome(20, 20).catastropheRisk, false)
})

test('applyCriticalFailReroll — cumule le retest sur la marge et recalcule le risque', () => {
  const base = resolveTestOutcome(20, 10) // mr=-10, isCriticalFail=true
  const after = applyCriticalFailReroll(base, 6)
  assert.equal(after.mr, -16) // -10 - 6
  assert.equal(after.catastropheRisk, true)
})

test('applyCriticalFailReroll — no-op si pas un échec critique', () => {
  const base = resolveTestOutcome(3, 10)
  assert.equal(applyCriticalFailReroll(base, 6), base)
})

test('getCriticalSuccessBonus — Test de Compétence : niveau de maîtrise tel quel', () => {
  assert.equal(getCriticalSuccessBonus({ masteryLevel: 5 }), 5)
  assert.equal(getCriticalSuccessBonus({ masteryLevel: 0 }), 0) // maîtrise 0 valide, pas "absent"
  assert.equal(getCriticalSuccessBonus({ masteryLevel: -3 }), -3) // compétence difficile, malus de départ
})

test('getCriticalSuccessBonus — Test d\'Attribut seul : moitié de l\'AN, arrondi inférieur', () => {
  assert.equal(getCriticalSuccessBonus({ attributeAN: 4 }), 2)
  assert.equal(getCriticalSuccessBonus({ attributeAN: 3 }), 1) // arrondi inférieur, pas Math.round
  assert.equal(getCriticalSuccessBonus({ attributeAN: -3 }), -2) // AN négatif (Aptitude naturelle faible)
})

test('getCriticalSuccessBonus — masteryLevel prioritaire si les deux sont fournis par erreur', () => {
  assert.equal(getCriticalSuccessBonus({ masteryLevel: 5, attributeAN: 4 }), 5)
})

test('getCriticalSuccessBonus — 0 si ni l\'un ni l\'autre fourni', () => {
  assert.equal(getCriticalSuccessBonus({}), 0)
  assert.equal(getCriticalSuccessBonus(), 0)
})

test('applyCriticalSuccessBonus — ajoute le bonus à la marge sur Réussite critique (p.204)', () => {
  const base = resolveTestOutcome(10, 10) // isCriticalSuccess=true, mr=10
  const after = applyCriticalSuccessBonus(base, 4)
  assert.equal(after.mr, 14)
  assert.equal(after.isSuccess, true)
  assert.equal(after.isCriticalSuccess, true) // jamais remis en cause par le bonus
})

test('applyCriticalSuccessBonus — no-op si pas une réussite critique', () => {
  const base = resolveTestOutcome(3, 10) // réussite ordinaire
  assert.equal(applyCriticalSuccessBonus(base, 4), base)
})

test('applyCriticalSuccessBonus — no-op si bonus nul/absent (évite un objet dupliqué inutilement)', () => {
  const base = resolveTestOutcome(10, 10)
  assert.equal(applyCriticalSuccessBonus(base, 0), base)
  assert.equal(applyCriticalSuccessBonus(base, undefined), base)
})

test('getMrModifier couvre toute la plage réussite (LdB p.209)', () => {
  assert.equal(getMrModifier(0), 0)
  assert.equal(getMrModifier(2), 0)
  assert.equal(getMrModifier(3), 1)
  assert.equal(getMrModifier(6), 2)
  assert.equal(getMrModifier(9), 3)
  assert.equal(getMrModifier(12), 4)
  assert.equal(getMrModifier(14), 5)
  assert.equal(getMrModifier(19), 6)
  assert.equal(getMrModifier(24), 7)
  assert.equal(getMrModifier(34), 8)
  assert.equal(getMrModifier(35), 9)
  assert.equal(getMrModifier(1000), 9)
})

test('getMrModifier couvre toute la plage échec (LdB p.209)', () => {
  assert.equal(getMrModifier(-1), 0)
  assert.equal(getMrModifier(-3), -1)
  assert.equal(getMrModifier(-5), -2)
  assert.equal(getMrModifier(-7), -3)
  assert.equal(getMrModifier(-10), -4)
  assert.equal(getMrModifier(-13), -5)
  assert.equal(getMrModifier(-15), -6)
  assert.equal(getMrModifier(-20), -7)
  assert.equal(getMrModifier(-25), -8)
  assert.equal(getMrModifier(-35), -9)
  assert.equal(getMrModifier(-1000), -9)
})

test('MR_TABLE — aucun trou ni recouvrement entre paliers consécutifs', () => {
  const lo = v => v === null ? -Infinity : v
  const hi = v => v === null ? Infinity : v
  const sorted = [...MR_TABLE].sort((a, b) => lo(a.min) - lo(b.min))
  for (let i = 0; i < sorted.length - 1; i++) {
    assert.equal(hi(sorted[i].max) + 1, lo(sorted[i + 1].min), `trou/recouvrement entre ${JSON.stringify(sorted[i])} et ${JSON.stringify(sorted[i + 1])}`)
  }
})
