import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RANGED_SITUATION_MODS, sumRangedSituationMods, isImpossibleRangedSituation,
  GM_ONLY_CONFIRMED_MODIFIER_KEYS, stripGmOnlyModifiers,
  rangedAllureKeyForGait, MOVEMENT_DERIVED_SITUATION_KEYS, applyDerivedAllureToSituation,
} from './combatSituationMods.js'
import { COMBAT_MOVEMENT_GAITS } from './combatMovement.js'

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

test('stripGmOnlyModifiers - retire taille, conserve les autres clés', () => {
  assert.deepEqual(GM_ONLY_CONFIRMED_MODIFIER_KEYS, ['taille'])
  const out = stripGmOnlyModifiers({ taille: 'grande', situation: ['couverture_partielle'], portee: 'courte' })
  assert.deepEqual(out, { situation: ['couverture_partielle'], portee: 'courte' })
  assert.ok(!('taille' in out))
})

test('stripGmOnlyModifiers - null / undefined passent tels quels, jamais un throw', () => {
  assert.equal(stripGmOnlyModifiers(null), null)
  assert.equal(stripGmOnlyModifiers(undefined), undefined)
})

test('stripGmOnlyModifiers - ne mute pas l\'entrée', () => {
  const input = { taille: 'petite', situation: [] }
  stripGmOnlyModifiers(input)
  assert.equal(input.taille, 'petite')
})

// ─── Allure dérivée du mouvement ────────────────────────────────────────────

test('rangedAllureKeyForGait - tireur : lente/moyenne/rapide/max mappés, null = immobile (aucune clé)', () => {
  assert.equal(rangedAllureKeyForGait('lente', 'shooter'), 'tireur_allure_lente')
  assert.equal(rangedAllureKeyForGait('moyenne', 'shooter'), 'tireur_allure_moyenne')
  assert.equal(rangedAllureKeyForGait('rapide', 'shooter'), 'tireur_allure_rapide')
  assert.equal(rangedAllureKeyForGait('max', 'shooter'), 'tireur_allure_maximale')
  assert.equal(rangedAllureKeyForGait(null, 'shooter'), null)
})

test('rangedAllureKeyForGait - cible : null = cible_immobile (+3), lente = aucune clé, moyenne+', () => {
  assert.equal(rangedAllureKeyForGait(null, 'target'), 'cible_immobile')
  assert.equal(rangedAllureKeyForGait('lente', 'target'), null)
  assert.equal(rangedAllureKeyForGait('moyenne', 'target'), 'cible_allure_moyenne')
  assert.equal(rangedAllureKeyForGait('rapide', 'target'), 'cible_allure_rapide')
  assert.equal(rangedAllureKeyForGait('max', 'target'), 'cible_allure_maximale')
})

test('rangedAllureKeyForGait - gait inconnu -> null (pas un throw), rôle inconnu -> throw', () => {
  assert.equal(rangedAllureKeyForGait('sprint', 'shooter'), null)
  assert.equal(rangedAllureKeyForGait('sprint', 'target'), null)
  assert.throws(() => rangedAllureKeyForGait('lente', 'defenseur'), /rôle inconnu/)
})

test('rangedAllureKeyForGait - toute clé produite existe dans RANGED_SITUATION_MODS', () => {
  for (const role of ['shooter', 'target']) {
    for (const gait of ['lente', 'moyenne', 'rapide', 'max', null]) {
      const key = rangedAllureKeyForGait(gait, role)
      if (key !== null) assert.ok(key in RANGED_SITUATION_MODS, `${key} absent de RANGED_SITUATION_MODS`)
    }
  }
})

test('MOVEMENT_DERIVED_SITUATION_KEYS - 8 clés d\'allure, toutes dans la table', () => {
  assert.equal(MOVEMENT_DERIVED_SITUATION_KEYS.length, 8)
  for (const k of MOVEMENT_DERIVED_SITUATION_KEYS) assert.ok(k in RANGED_SITUATION_MODS)
  // couvre exactement les clés d'allure de la table (préfixe tireur_allure / cible_)
  const allureInTable = Object.keys(RANGED_SITUATION_MODS)
    .filter(k => k.startsWith('tireur_allure_') || k.startsWith('cible_'))
  assert.deepEqual([...MOVEMENT_DERIVED_SITUATION_KEYS].sort(), allureInTable.sort())
})

test('combatMovement - les 4 gaits de COMBAT_MOVEMENT_GAITS sont ceux du mapping d\'allure', () => {
  const gaits = COMBAT_MOVEMENT_GAITS.map(d => d.gait).sort()
  assert.deepEqual(gaits, ['lente', 'max', 'moyenne', 'rapide'])
  // chaque gait réel produit une clé valide (ou null) pour les deux rôles
  for (const g of gaits) {
    for (const role of ['shooter', 'target']) {
      const key = rangedAllureKeyForGait(g, role)
      if (key !== null) assert.ok(key in RANGED_SITUATION_MODS)
    }
  }
})

test('applyDerivedAllureToSituation - injecte les clés serveur sur un tableau vide', () => {
  assert.deepEqual(
    applyDerivedAllureToSituation([], { shooterAllureKey: 'tireur_allure_moyenne', targetAllureKey: 'cible_allure_rapide' }),
    ['tireur_allure_moyenne', 'cible_allure_rapide'],
  )
})

test('applyDerivedAllureToSituation - préserve couverture/obscurité, remplace l\'allure client', () => {
  const out = applyDerivedAllureToSituation(
    ['couverture_partielle', 'tireur_allure_maximale', 'obscurite_legere', 'cible_immobile'],
    { shooterAllureKey: 'tireur_allure_lente', targetAllureKey: null },
  )
  assert.deepEqual(out, ['couverture_partielle', 'obscurite_legere', 'tireur_allure_lente'])
})

test('applyDerivedAllureToSituation - deux clés null -> retire l\'allure, garde le reste', () => {
  assert.deepEqual(
    applyDerivedAllureToSituation(['couverture_importante', 'cible_allure_maximale'], {}),
    ['couverture_importante'],
  )
})

test('applyDerivedAllureToSituation - situation absente -> base vide', () => {
  assert.deepEqual(
    applyDerivedAllureToSituation(undefined, { shooterAllureKey: 'tireur_allure_rapide', targetAllureKey: null }),
    ['tireur_allure_rapide'],
  )
})

test('applyDerivedAllureToSituation + sumRangedSituationMods - composables', () => {
  const situation = applyDerivedAllureToSituation(
    ['couverture_partielle'],
    { shooterAllureKey: 'tireur_allure_rapide', targetAllureKey: null },
  )
  assert.equal(sumRangedSituationMods(situation), -3 + -7)
})
