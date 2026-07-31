import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePolarisTest } from './polarisTestService.js'

// Lancement manuel (aucun script npm test dans le projet) :
//   node --test server/src/lib/polarisTestService.test.mjs

test('roll retourne toujours un entier entre 1 et 20', async () => {
  for (let i = 0; i < 200; i++) {
    const { roll } = await resolvePolarisTest(10)
    assert.ok(Number.isInteger(roll) && roll >= 1 && roll <= 20)
  }
})

test('isSuccess suit roll <= threshold', async () => {
  for (let i = 0; i < 300; i++) {
    const { roll, threshold, isSuccess } = await resolvePolarisTest(10)
    assert.equal(isSuccess, roll <= threshold)
  }
})

test('réussite critique = roll===threshold, jamais fixée à roll===1', async () => {
  // threshold=1 : seul un roll de 1 peut être critique (et c'est bien le cas, coïncidence du seuil).
  for (let i = 0; i < 300; i++) {
    const { roll, isCriticalSuccess } = await resolvePolarisTest(1)
    assert.equal(isCriticalSuccess, roll === 1)
  }
  // threshold=10 : un roll de 1 n'est PAS critique (ancienne règle roll===1 aurait dit le contraire).
  for (let i = 0; i < 300; i++) {
    const { roll, isCriticalSuccess } = await resolvePolarisTest(10)
    if (roll === 1) assert.equal(isCriticalSuccess, false)
    if (roll === 10) assert.equal(isCriticalSuccess, true)
  }
})

test('échec critique = roll===20, seulement si threshold < 20 (jamais Catastrophe automatique)', async () => {
  for (let i = 0; i < 300; i++) {
    const { roll, isSuccess, isCriticalFail, mr } = await resolvePolarisTest(10)
    if (roll === 20) {
      assert.equal(isCriticalFail, true)
      assert.equal(isSuccess, false)
      // mr initial (avant retest) = 10-20 = -10, puis dégradé par le retest (toujours ≤ -10).
      assert.ok(mr <= -10)
    }
  }
})

test('threshold >= 20 : aucun échec critique possible, un 20 devient réussite critique', async () => {
  for (let i = 0; i < 300; i++) {
    const { roll, isSuccess, isCriticalSuccess, isCriticalFail } = await resolvePolarisTest(20)
    assert.equal(isSuccess, true) // roll max 20 <= threshold 20, toujours réussi
    assert.equal(isCriticalFail, false)
    if (roll === 20) assert.equal(isCriticalSuccess, true)
  }
})

test('retest d\'Échec critique — criticalFailReroll rempli seulement quand isCriticalFail', async () => {
  let sawCriticalFail = false
  for (let i = 0; i < 300; i++) {
    const { isCriticalFail, criticalFailReroll } = await resolvePolarisTest(10)
    if (isCriticalFail) {
      sawCriticalFail = true
      assert.ok(Number.isInteger(criticalFailReroll) && criticalFailReroll >= 1 && criticalFailReroll <= 20)
    } else {
      assert.equal(criticalFailReroll, null)
    }
  }
  assert.ok(sawCriticalFail, 'aucun Échec critique observé en 300 tirages — augmenter le nombre d\'essais')
})

test('catastropheRisk atteignable après cumul du retest (marge d\'échec ≥ 15)', async () => {
  // threshold=1 maximise la marge d'échec initiale (19) sur tout roll!=1, donc tout Échec critique
  // (roll===20) part déjà d'une marge de 19 avant même le retest.
  let sawCatastrophe = false
  for (let i = 0; i < 300; i++) {
    const { isCriticalFail, catastropheRisk } = await resolvePolarisTest(1)
    if (isCriticalFail) {
      assert.equal(catastropheRisk, true) // marge initiale déjà 19, ne peut qu'empirer
      sawCatastrophe = true
    }
  }
  assert.ok(sawCatastrophe, 'aucun Échec critique observé en 300 tirages — augmenter le nombre d\'essais')
})

test('criticalSuccessBonus (Lot 2) — ajouté à mr seulement sur Réussite critique', async () => {
  let sawCrit = false
  for (let i = 0; i < 500; i++) {
    const { roll, isCriticalSuccess, mr } = await resolvePolarisTest(10, 4)
    if (isCriticalSuccess) {
      sawCrit = true
      assert.equal(mr, roll + 4) // roll===10 (seul cas critique possible pour threshold=10)
    } else if (roll <= 10) {
      assert.equal(mr, roll) // réussite ordinaire, bonus non appliqué
    }
  }
  assert.ok(sawCrit, 'aucune Réussite critique observée en 500 tirages — augmenter le nombre d\'essais')
})

test('criticalSuccessBonus absent (défaut 0) — comportement inchangé pour les appelants existants', async () => {
  for (let i = 0; i < 100; i++) {
    const { roll, isSuccess, mr } = await resolvePolarisTest(10)
    if (isSuccess) assert.equal(mr, roll)
  }
})

test('threshold retourné = threshold fourni (traçabilité du résultat)', async () => {
  const { threshold } = await resolvePolarisTest(14)
  assert.equal(threshold, 14)
})
