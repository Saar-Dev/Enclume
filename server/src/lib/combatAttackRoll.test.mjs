import test from 'node:test'
import assert from 'node:assert/strict'

import { computeAttackRoll, computeMeleeRawDamage } from './combatAttackRoll.js'

// Lancement manuel (aucun script npm test dans le projet, PLAN_RW_SYSCOMBAT.md §2.2) :
//   node --test server/src/lib/combatAttackRoll.test.mjs

test('aucune contribution — breakdown = base + total, seuil = compétence', () => {
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 12, contributions: [], totalLabel: 'Seuil', rollAttaque: 5,
  })
  assert.equal(r.seuil, 12)
  assert.deepEqual(r.breakdown, [
    { label: 'Compétence', value: 12, type: 'base' },
    { label: 'Seuil', value: 12, type: 'total' },
  ])
})

test('somme mixte bonus/malus', () => {
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 10, totalLabel: 'Seuil', rollAttaque: 5,
    contributions: [
      { label: 'Mode offensif', value: 3, type: 'bonus' },
      { label: 'Multi-adversaires', value: -3, type: 'malus' },
      { label: 'Malus santé', value: -2, type: 'malus' },
    ],
  })
  assert.equal(r.seuil, 8)
})

test('contribution à zéro — absente du breakdown, somme inchangée', () => {
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 10, totalLabel: 'Seuil', rollAttaque: 5,
    contributions: [
      { label: 'Précipitation', value: 0, type: 'malus' },
      { label: 'Taille cible', value: 3, type: 'bonus' },
    ],
  })
  assert.equal(r.seuil, 13)
  assert.equal(r.breakdown.length, 3) // base + taille + total
  assert.ok(!r.breakdown.some(e => e.label === 'Précipitation'))
})

test('ordre préservé — base en tête, contributions dans l\'ordre fourni, total en queue', () => {
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 10, totalLabel: 'Seuil', rollAttaque: 5,
    contributions: [
      { label: 'B', value: 1, type: 'bonus' },
      { label: 'A', value: -1, type: 'malus' },
      { label: 'C', value: 2, type: 'bonus' },
    ],
  })
  assert.deepEqual(r.breakdown.map(e => e.label), ['Compétence', 'B', 'A', 'C', 'Seuil'])
  assert.equal(r.breakdown[0].type, 'base')
  assert.equal(r.breakdown.at(-1).type, 'total')
})

test('contributions se compensant — toutes deux conservées (RV2 : le masquage agrégé est en coquille)', () => {
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 10, totalLabel: 'Seuil', rollAttaque: 5,
    contributions: [
      { label: 'Mod +2', value: 2, type: 'bonus' },
      { label: 'Mod -2', value: -2, type: 'malus' },
    ],
  })
  assert.equal(r.seuil, 10)
  assert.equal(r.breakdown.length, 4) // base + 2 entrées conservées + total
})

test('bornes isSuccess/mr — RAW : marge de réussite = roll direct, marge d\'échec = roll-seuil', () => {
  const base = { skillLabel: 'Compétence', skillTotal: 10, contributions: [], totalLabel: 'Seuil' }
  const equal = computeAttackRoll({ ...base, rollAttaque: 10 })
  assert.equal(equal.isSuccess, true)
  assert.equal(equal.isCriticalSuccess, true) // roll===seuil
  assert.equal(equal.mr, 10)
  const above = computeAttackRoll({ ...base, rollAttaque: 11 })
  assert.equal(above.isSuccess, false)
  assert.equal(above.mr, -1)
  const below = computeAttackRoll({ ...base, rollAttaque: 3 })
  assert.equal(below.isSuccess, true)
  assert.equal(below.mr, 3)
})

test('critique/Catastrophe délégués à resolveTestOutcome (docs/PLAN_TEST_CRITIQUE.md)', () => {
  const base = { skillLabel: 'Compétence', skillTotal: 10, contributions: [], totalLabel: 'Seuil' }
  // Réussite critique = roll===seuil, jamais roll===1 fixe.
  assert.equal(computeAttackRoll({ ...base, rollAttaque: 1 }).isCriticalSuccess, false)
  assert.equal(computeAttackRoll({ ...base, rollAttaque: 10 }).isCriticalSuccess, true)
  // Échec critique = roll===20 exactement, jamais assimilé à une Catastrophe automatique.
  const critFail = computeAttackRoll({ ...base, rollAttaque: 20 })
  assert.equal(critFail.isSuccess, false)
  assert.equal(critFail.isCriticalFail, true)
  assert.equal(critFail.catastropheRisk, false) // mr=-10, sous le seuil de 15
})

test('cas réaliste CaC — mode offensif + multi-adversaires + santé (valeurs LdB calculées à la main)', () => {
  // Compétence 12, Mode offensif +3, Multi-adversaires -3, Malus santé -2 → Seuil 10 ; roll 7 réussi → marge = roll = 7
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 12, totalLabel: 'Seuil', rollAttaque: 7,
    contributions: [
      { label: 'Mode offensif', value: 3, type: 'bonus' },
      { label: 'Précipitation', value: 0, type: 'malus' },
      { label: 'Multi-adversaires (attaquant)', value: -3, type: 'malus' },
      { label: 'Malus santé / encombrement', value: -2, type: 'malus' },
    ],
  })
  assert.equal(r.seuil, 10)
  assert.equal(r.isSuccess, true)
  assert.equal(r.mr, 7)
  assert.deepEqual(r.breakdown, [
    { label: 'Compétence', value: 12, type: 'base' },
    { label: 'Mode offensif', value: 3, type: 'bonus' },
    { label: 'Multi-adversaires (attaquant)', value: -3, type: 'malus' },
    { label: 'Malus santé / encombrement', value: -2, type: 'malus' },
    { label: 'Seuil', value: 10, type: 'total' },
  ])
})

test('cas réaliste Tir — portée moyenne + mode de tir + taille + couverture (valeurs LdB)', () => {
  // Compétence 14, Portée moyenne -5, Mode de tir +2, Cible grande +3, Couverture partielle -3 → Seuil 11
  const r = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: 14, totalLabel: 'Seuil', rollAttaque: 12,
    contributions: [
      { label: 'Portée moyenne', value: -5, type: 'malus' },
      { label: 'Mode de tir (×2)', value: 2, type: 'bonus' },
      { label: 'Cible grande (~3m)', value: 3, type: 'bonus' },
      { label: 'Couverture partielle (50%)', value: -3, type: 'malus' },
    ],
  })
  assert.equal(r.seuil, 11)
  assert.equal(r.isSuccess, false) // 12 > 11
  assert.equal(r.mr, -1)
})

// computeMeleeRawDamage — dédup des 5 sites socketCombatHelpers.js (PLAN_RW_SYSCOMBAT.md §2.7).

test('computeMeleeRawDamage — modDom et combatModeBonus à 0, mr>=0 (assezBon, +2)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 8, mr: 5, modDom: 0, combatModeBonus: 0 }), 10)
})

test('computeMeleeRawDamage — modDom/combatModeBonus null/undefined traités comme 0 (sites différés confirmMeleeDefense/confirmDamage, §2.7.a)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 6, mr: -3, modDom: null, combatModeBonus: undefined }), 5)
})

test('computeMeleeRawDamage — mr positif élevé (héroïque, +8)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 10, mr: 30, modDom: 3, combatModeBonus: 3 }), 24)
})

test('computeMeleeRawDamage — mr négatif extrême (catastrophique, -9)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 10, mr: -40, modDom: 0, combatModeBonus: 0 }), 1)
})

test('computeMeleeRawDamage — mr nul (deJustesse, +0)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 5, mr: 0, modDom: 1, combatModeBonus: 0 }), 6)
})

test('computeMeleeRawDamage — cas réaliste attaquant PNJ touche défenseur PJ (confirmMeleeDefense, site #4)', () => {
  // Couteau 1D6=4, mr=7 (bon +3), modDom(FOR)=2, pas de mode combat
  assert.equal(computeMeleeRawDamage({ rawDice: 4, mr: 7, modDom: 2, combatModeBonus: 0 }), 9)
})

test('computeMeleeRawDamage — cas réaliste défenseur PNJ, mode Charge actif (resolveMeleeDefensePnj, site #2)', () => {
  // Dague=5, mr=10 (très bon +4), modDom=1, Charge +3
  assert.equal(computeMeleeRawDamage({ rawDice: 5, mr: 10, modDom: 1, combatModeBonus: 3 }), 13)
})

test('computeMeleeRawDamage — cas réaliste cible drone (resolveMeleeDefenseDrone, site #3)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 7, mr: -5, modDom: 0, combatModeBonus: 0 }), 5)
})

test('computeMeleeRawDamage — cas réaliste cible sans défense DEF5 (resolveDefenselessTarget, site #1)', () => {
  assert.equal(computeMeleeRawDamage({ rawDice: 9, mr: 15, modDom: 2, combatModeBonus: 0 }), 17)
})
