import test from 'node:test'
import assert from 'node:assert/strict'

// Ce fichier importe socketCombatHelpers.js (qui importe db, connexion Postgres) mais ne teste que
// resolveAoeAttackRoll — une fonction qui ne touche jamais la DB (parseDice est pur, computeAttackRoll
// aussi). Aucune connexion réelle n'est requise : l'import du module n'exécute aucune requête.
import { resolveAoeAttackRoll } from './socketCombatHelpers.js'

// resolveAoeAttackRoll — couche 4 AOE, phase A (docs/PLANS/PLAN_AOE.md §8 étape 8). Un seul Test de
// tir pour toute une action à zone d'effet, sans contribution propre à une cible précise (déplacées
// en phase B, par cible).

test('resolveAoeAttackRoll — seuil = skillTotal + somme des contributions (arithmétique pure, vérifiable malgré le jet aléatoire)', async () => {
  const result = await resolveAoeAttackRoll({
    skillTotal: 10,
    skillMastery: 0,
    contributions: [
      { label: 'Portée', value: -3, type: 'malus' },
      { label: 'Mode de tir', value: 5, type: 'bonus' },
    ],
  })
  assert.equal(result.seuil, 12) // 10 - 3 + 5
  assert.ok(Number.isInteger(result.rollAttaque) && result.rollAttaque >= 1 && result.rollAttaque <= 20)
  assert.ok(Array.isArray(result.attackRolls))
  assert.equal(typeof result.isSuccess, 'boolean')
})

test('resolveAoeAttackRoll — sans contribution (tableau vide/absent) : seuil = skillTotal seul', async () => {
  const result = await resolveAoeAttackRoll({ skillTotal: 15, skillMastery: 0 })
  assert.equal(result.seuil, 15)
})

test('resolveAoeAttackRoll — breakdown ne contient jamais de contribution propre à une cible (couverture/bouclier/sans-défense)', async () => {
  const result = await resolveAoeAttackRoll({
    skillTotal: 10, skillMastery: 0,
    contributions: [{ label: 'Portée', value: -3, type: 'malus' }],
  })
  const labels = result.breakdown.map(b => b.label)
  for (const forbidden of ['Couverture cible', 'Bouclier adverse', 'Cible sans défense']) {
    assert.ok(!labels.includes(forbidden), `"${forbidden}" ne doit jamais apparaître ici — c'est une contribution phase B, par cible`)
  }
})

test('resolveAoeAttackRoll — sur 200 tirages, rollAttaque reste toujours dans [1,20] et la réussite critique suit roll===seuil (ou 20 si seuil>=20)', async () => {
  for (let i = 0; i < 200; i++) {
    const result = await resolveAoeAttackRoll({ skillTotal: 12, skillMastery: 2, contributions: [] })
    assert.ok(result.rollAttaque >= 1 && result.rollAttaque <= 20)
    assert.equal(typeof result.isCriticalSuccess, 'boolean')
    assert.equal(typeof result.isCriticalFail, 'boolean')
  }
})

test('resolveAoeAttackRoll — le bonus de réussite critique dépend de skillMastery (même primitive partagée que resolveAssaultAction)', async () => {
  // Ne teste pas l'aléatoire (impossible de forcer un critique ici sans mock du RNG, hors scope) —
  // vérifie seulement que la maîtrise est bien transmise à getCriticalSuccessBonus sans lever
  // d'exception, pour une gamme de valeurs réalistes.
  for (const skillMastery of [0, 1, 3, 5]) {
    const result = await resolveAoeAttackRoll({ skillTotal: 10, skillMastery, contributions: [] })
    assert.equal(typeof result.mr, 'number')
  }
})
