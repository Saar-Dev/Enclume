import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DANGER_CATALOG, DANGER_CATEGORIES, listDangerDefinitions, getDangerDefinition } from './dangerCatalog.js'

const EFFECT_KEY_RE = /^[a-z][a-z0-9:._-]{1,63}$/

test('le catalogue se charge sans jeter et expose au moins une définition par catégorie', () => {
  const defs = listDangerDefinitions()
  assert.ok(defs.length > 0)
  const categories = new Set(defs.map(d => d.category))
  for (const category of DANGER_CATEGORIES) assert.ok(categories.has(category), `catégorie ${category} absente du catalogue`)
})

test('chaque entrée a une source RAW non vide et une key conforme à EFFECT_KEY_RE', () => {
  for (const definition of listDangerDefinitions()) {
    assert.ok(EFFECT_KEY_RE.test(definition.key), `clé invalide : ${definition.key}`)
    assert.ok(definition.source && definition.source.length > 0, `${definition.key} sans citation RAW`)
    assert.ok(DANGER_CATEGORIES.has(definition.category), `${definition.key} catégorie hors DANGER_CATEGORIES`)
  }
})

test('feu:* — 4 intensités, brasier = toutes les Localisations (décision Saar B3)', () => {
  const feux = listDangerDefinitions().filter(d => d.category === 'feu')
  assert.equal(feux.length, 4)
  assert.deepEqual(feux.map(d => d.key).sort(), ['feu:brasier', 'feu:grand', 'feu:moyen', 'feu:petit'])

  const brasier = getDangerDefinition('feu:brasier')
  assert.equal(brasier.effects[0].locationMode, 'all')
  assert.equal(brasier.effects[0].locations, null, 'locationMode:all ⟹ locations ignoré, jamais 0')
  assert.equal(brasier.effects[0].formula, '3d10')

  const petit = getDangerDefinition('feu:petit')
  assert.equal(petit.effects[0].locationMode, 'exposed')
  assert.equal(petit.effects[0].formula, '1d6')
})

test('les 6 gaz du §5.3 sont présents, chacun avec au moins une ligne (résolue v1 ou stub v2)', () => {
  const gazKeys = listDangerDefinitions().filter(d => d.category === 'gaz').map(d => d.key).sort()
  assert.deepEqual(gazKeys, [
    'gaz:decomposant', 'gaz:irritant', 'gaz:neurotoxique', 'gaz:suffocant', 'gaz:vesicant', 'gaz:assommant',
  ].sort())
  for (const key of gazKeys) assert.ok(getDangerDefinition(key).effects.length > 0, `${key} sans ligne d'effet`)
  // Tous les gaz dissipent conditionnellement (vent/aération, §5.3 préambule) — aucun n'est permanent.
  for (const key of gazKeys) assert.equal(getDangerDefinition(key).durationPolicy, 'conditional')
})

test('radiation:* — 3 intensités, accumulateLevel à l’entrée seulement (§5.7 : rien à l’échelle du Tour)', () => {
  const radiations = listDangerDefinitions().filter(d => d.category === 'radiation')
  assert.equal(radiations.length, 3)
  for (const definition of radiations) {
    assert.equal(definition.effects.length, 1)
    assert.equal(definition.effects[0].type, 'accumulateLevel')
    assert.equal(definition.effects[0].phase, 'onEnter')
  }
  assert.deepEqual(
    radiations.map(d => d.effects[0].formula).sort(),
    ['1d6', '2d6', '3d6'],
  )
})

test('corrodes ⊂ matériaux déjà cités par le plan (chair, métal) — aucun 3e matériau inventé', () => {
  const knownMaterials = new Set(['chair', 'métal'])
  for (const definition of listDangerDefinitions()) {
    for (const material of definition.corrodes) assert.ok(knownMaterials.has(material), `matériau inconnu : ${material}`)
  }
  assert.deepEqual(getDangerDefinition('acide:capsule').corrodes, ['chair', 'métal'])
})

test('hazardCode couvre exactement les 3 familles Lot 3 (feu/acide/décompression) — dérivation Z1.4', () => {
  const withHazardCode = listDangerDefinitions().filter(d => d.hazardCode != null)
  const codes = new Set(withHazardCode.map(d => d.hazardCode))
  assert.deepEqual([...codes].sort(), ['acid', 'burning', 'decompression'])
  // Les 4 feux partagent le MÊME hazardCode (burning) — la dérivation Z1.4 doit dédupliquer, pas
  // produire 4 entrées 'burning' dans ENVIRONMENTAL_HAZARD_REGISTRY.
  assert.equal(listDangerDefinitions().filter(d => d.hazardCode === 'burning').length, 4)
  // Gaz et radiations ne sont pas (encore) des dangers Lot 3 — hazardCode reste null, pas une valeur inventée.
  for (const definition of listDangerDefinitions()) {
    if (definition.category === 'gaz' || definition.category === 'radiation') assert.equal(definition.hazardCode, null)
  }
})

test('decompression porte forcedLocation:\'corps\' au niveau DÉFINITION (prime sur locationMode de la ligne)', () => {
  const definition = getDangerDefinition('decompression')
  assert.equal(definition.forcedLocation, 'corps')
  assert.equal(definition.hazardCode, 'decompression')
  assert.equal(definition.effects[0].forcedLocation, null, 'la ligne elle-même ne fixe pas de forcedLocation : la définition prime')
})

test('DANGER_CATALOG est une table plate gelée, jamais mutable en aval', () => {
  assert.ok(Object.isFrozen(DANGER_CATALOG))
  assert.throws(() => { DANGER_CATALOG['feu:petit'] = null }, TypeError)
  assert.ok(Object.isFrozen(getDangerDefinition('feu:petit')))
})
