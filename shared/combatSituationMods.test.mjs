import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RANGED_SITUATION_MODS, sumRangedSituationMods, isImpossibleRangedSituation } from './combatSituationMods.js'

test('sumRangedSituationMods - additionne les modificateurs connus', () => {
  assert.equal(sumRangedSituationMods(['couverture_partielle', 'obscurite_legere']), -6)
})

test('sumRangedSituationMods - clé inconnue ignorée, jamais un throw', () => {
  assert.equal(sumRangedSituationMods(['inconnu', 'couverture_importante']), -5)
})

test('sumRangedSituationMods - tableau vide -> 0', () => {
  assert.equal(sumRangedSituationMods([]), 0)
  assert.equal(sumRangedSituationMods(), 0)
})

test('sumRangedSituationMods - une clé "impossible" ne pollue jamais la somme (mod:0)', () => {
  assert.equal(sumRangedSituationMods(['tireur_allure_maximale', 'couverture_partielle']), -3)
})

test('isImpossibleRangedSituation - TIRIMP : allure maximale tireur détectée', () => {
  assert.equal(isImpossibleRangedSituation(['tireur_allure_moyenne', 'tireur_allure_maximale']), true)
})

test('isImpossibleRangedSituation - TIRIMP : obscurité totale détectée', () => {
  assert.equal(isImpossibleRangedSituation(['obscurite_totale']), true)
})

test('isImpossibleRangedSituation - combinaison normale -> false', () => {
  assert.equal(isImpossibleRangedSituation(['couverture_partielle', 'obscurite_importante', 'cible_allure_maximale']), false)
})

test('isImpossibleRangedSituation - tableau vide/absent -> false', () => {
  assert.equal(isImpossibleRangedSituation([]), false)
  assert.equal(isImpossibleRangedSituation(), false)
})

test('RANGED_SITUATION_MODS - seules les 2 clés RAW sans exception sont impossible:true', () => {
  const impossibleKeys = Object.entries(RANGED_SITUATION_MODS)
    .filter(([, v]) => v.impossible === true)
    .map(([k]) => k)
  assert.deepEqual(impossibleKeys.sort(), ['obscurite_totale', 'tireur_allure_maximale'])
})
