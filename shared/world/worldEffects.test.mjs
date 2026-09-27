import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from './worldContracts.js'
import {
  BUILTIN_WORLD_EFFECTS,
  collectPathEffectEvents,
  compileEffectRegions,
  collectTargetEffectHooks,
  effectMovementFactorsForSegment,
  effectOccludersFromRegions,
  normalizeEffectDefinition,
  propagateEffectThroughCompartments,
} from './worldEffects.js'

function snapshot(spatial = {}) {
  return createWorldSnapshot({
    battlemapId: 'effects-test',
    spatial: {
      supports: [], barriers: [], traversals: [], colliders: [], occluders: [], compartments: [], regions: [],
      ...spatial,
    },
  })
}

const volume = {
  min: { x: 1, y: 0, z: 0 },
  max: { x: 2, y: 2, z: 1 },
}

test('un effet personnalisé reste déclaratif et refuse les modificateurs inconnus', () => {
  const definition = normalizeEffectDefinition({
    key: 'debris-lourds',
    label: 'Débris lourds',
    modifiers: { movementMultiplier: 5 },
    hooks: [{ event: 'traverse', type: 'note', note: 'Le MJ décide du bruit.' }],
  }, { custom: true })
  assert.equal(definition.modifiers.movementMultiplier, 5)
  assert.throws(() => normalizeEffectDefinition({
    key: 'script', label: 'Script', modifiers: { execute: 'process.exit()' },
  }, { custom: true }), /inconnu/)
})

test('une zone d’huile traversée modifie le coût même si la destination est hors de la zone', () => {
  const regions = compileEffectRegions(snapshot(), {
    instances: [{
      id: 'oil-1', definitionKey: 'oil', targetKind: 'volume', volume, intensity: 2, state: 'active',
    }],
  })
  const factors = effectMovementFactorsForSegment(
    regions,
    { x: 0, y: 0.5, z: 0.5 },
    { x: 3, y: 0.5, z: 0.5 },
  )
  assert.deepEqual(factors.map(factor => factor.value), [2])
  const events = collectPathEffectEvents(regions, [{
    id: 'segment-1', from: { x: 0, y: 0.5, z: 0.5 }, to: { x: 3, y: 0.5, z: 0.5 },
  }])
  assert.deepEqual(events.map(event => event.event), ['traverse'])
  assert.equal(events[0].hooks[0].testKey, 'balance')
})

test('deux effets de même catégorie utilisent max et deux catégories se multiplient', () => {
  const definitions = [{
    key: 'boue', label: 'Boue', category: 'terrain:footing', stacking: 'max',
    modifiers: { movementMultiplier: 3 },
  }, {
    key: 'gravite', label: 'Gravité forte', category: 'environment:gravity', stacking: 'multiply',
    modifiers: { movementMultiplier: 2 },
  }]
  const regions = compileEffectRegions(snapshot(), {
    definitions,
    instances: [
      { id: 'oil', definitionKey: 'oil', targetKind: 'volume', volume },
      { id: 'mud', definitionKey: 'boue', targetKind: 'volume', volume },
      { id: 'gravity', definitionKey: 'gravite', targetKind: 'volume', volume },
    ],
  })
  const factors = effectMovementFactorsForSegment(regions, { x: 1.1, y: 1, z: 0.5 }, { x: 1.9, y: 1, z: 0.5 })
  assert.deepEqual(factors.map(factor => factor.value).sort((a, b) => a - b), [2, 3])
})

test('feu et gaz produisent des occluders atténuants, jamais un mur implicite', () => {
  const regions = compileEffectRegions(snapshot(), {
    instances: [
      { id: 'fire', definitionKey: 'fire', targetKind: 'volume', volume },
      { id: 'gas', definitionKey: 'gas', targetKind: 'volume', volume },
    ],
  })
  const occluders = effectOccludersFromRegions(regions)
  assert.equal(occluders.length, 2)
  assert.ok(occluders.every(occluder => occluder.opacity > 0 && occluder.opacity < 1))
})

test('un gaz se propage entre compartiments seulement si le canal de porte est perméable', () => {
  const baseSpatial = {
    compartments: [
      { id: 'compartment:a', bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2, z: 1 } } },
      { id: 'compartment:b', bounds: { min: { x: 1, y: 0, z: 0 }, max: { x: 2, y: 2, z: 1 } } },
    ],
    traversals: [{ id: 'door-edge', kind: 'door', sourceId: 'door-1', roomIds: ['a', 'b'] }],
  }
  const open = snapshot({
    ...baseSpatial,
    barriers: [{ id: 'door', sourceId: 'door-1', blocks: { gas: false, water: true } }],
  })
  const gas = propagateEffectThroughCompartments(open, {
    originCompartmentId: 'compartment:a', channel: 'gas', intensity: 1, attenuation: 0.5,
  })
  assert.deepEqual(gas, [
    { compartmentId: 'compartment:a', intensity: 1 },
    { compartmentId: 'compartment:b', intensity: 0.5 },
  ])
  const water = propagateEffectThroughCompartments(open, {
    originCompartmentId: 'compartment:a', channel: 'water', intensity: 1,
  })
  assert.deepEqual(water, [{ compartmentId: 'compartment:a', intensity: 1 }])
})

test('un effet attaché à un token expose ses hooks de début de tour sans région spatiale', () => {
  const hooks = collectTargetEffectHooks({
    instances: [{
      id: 'burning-token', definitionKey: 'fire', targetKind: 'token', targetId: 'token-1', state: 'active',
    }],
    targetKind: 'token',
    targetId: 'token-1',
    event: 'turnStart',
  })
  assert.equal(hooks.length, 1)
  assert.equal(hooks[0].hook.damageType, 'fire')
})

// PLAN_ZONES_DANGER.md §13.2/§13.6 (Z0) — les 5 builtins legacy ne passent aucun des 8 blocs danger :
// leur sortie doit rester EXACTEMENT celle d'avant l'extension, défauts neutres partout.
test('les 5 builtins legacy ressortent avec les blocs danger à leur défaut neutre (non-régression Z0)', () => {
  for (const key of ['fire', 'flooded', 'gas', 'oil', 'unstable']) {
    const definition = BUILTIN_WORLD_EFFECTS[key]
    assert.deepEqual(definition.tags, [])
    assert.equal(definition.durationPolicy, 'permanent')
    assert.equal(definition.stackingPolicy, 'max')
    assert.deepEqual(definition.effects, [])
    assert.deepEqual(definition.attenuations, [])
    assert.deepEqual(definition.chaining, [])
    assert.deepEqual(definition.corrodes, [])
    assert.equal(definition.source, null)
    assert.equal(definition.hazardCode, null)
    assert.equal(definition.forcedLocation, null)
  }
  // Les champs legacy eux-mêmes n'ont pas bougé (mêmes valeurs qu'avant Z0).
  assert.equal(BUILTIN_WORLD_EFFECTS.fire.category, 'hazard:fire')
  assert.equal(BUILTIN_WORLD_EFFECTS.fire.hooks.length, 1)
  assert.equal(BUILTIN_WORLD_EFFECTS.fire.hooks[0].amountPerIntensity, 1)
})

test('une définition custom round-trip les 8 blocs danger + hazardCode/forcedLocation (Z0)', () => {
  const definition = normalizeEffectDefinition({
    key: 'test:danger', label: 'Danger de test', category: 'test',
    tags: ['hazard:test'],
    durationPolicy: 'conditional', durationParams: { condition: 'aération' },
    stackingPolicy: 'independent',
    effects: [{ type: 'damage', phase: 'onTurn', formula: '1d6', damageType: 'test' }],
    attenuations: [{ by: 'trait', key: 'fireproof', effect: 'partial' }],
    chaining: [{ engendre: 'test:autre', délai: 1 }],
    corrodes: ['chair'],
    source: 'test unitaire',
    hazardCode: 'test_hazard',
    forcedLocation: 'corps',
  }, { custom: true })
  assert.equal(definition.durationPolicy, 'conditional')
  assert.deepEqual(definition.durationParams, { condition: 'aération' })
  assert.equal(definition.effects[0].formula, '1d6')
  assert.equal(definition.attenuations[0].effect, 'partial')
  assert.equal(definition.chaining[0].engendre, 'test:autre')
  assert.deepEqual(definition.corrodes, ['chair'])
  assert.equal(definition.hazardCode, 'test_hazard')
  assert.equal(definition.forcedLocation, 'corps')
})

test('key namespacée par ":" désormais acceptée (catalogue danger) ; forcedLocation de définition invalide rejeté', () => {
  const definition = normalizeEffectDefinition({ key: 'feu:test', label: 'x' }, { custom: true })
  assert.equal(definition.key, 'feu:test')
  assert.throws(() => normalizeEffectDefinition({
    key: 'x', label: 'x', forcedLocation: 'aile_gauche',
  }, { custom: true }), RangeError)
})
