import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EFFECT_LINE_TYPES, EFFECT_LINE_PHASES, RESOLVED_EFFECT_LINE_TYPES_V1,
  normalizeEffectLine, normalizeEffectLines, normalizeNestedEffectLine,
  normalizeAttenuation, normalizeAttenuations, normalizeChainingRule, normalizeChainingRules,
  normalizeCorrodes,
} from './dangerEffectLines.js'

test('EFFECT_LINE_TYPES porte les 13 types, v1 en résout 4', () => {
  assert.equal(EFFECT_LINE_TYPES.size, 13)
  assert.deepEqual([...RESOLVED_EFFECT_LINE_TYPES_V1].sort(), ['damage', 'modifier', 'note', 'status'])
  for (const type of RESOLVED_EFFECT_LINE_TYPES_V1) assert.ok(EFFECT_LINE_TYPES.has(type))
})

test('type inconnu rejeté, jamais un no-op silencieux à la validation', () => {
  assert.throws(() => normalizeEffectLine({ type: 'teleport', phase: 'onTurn' }), RangeError)
})

test('phase inconnue rejetée sur une ligne top-level', () => {
  assert.throws(() => normalizeEffectLine({ type: 'note', phase: 'onWhatever', label: 'x' }), RangeError)
  assert.throws(() => normalizeEffectLine({ type: 'note', label: 'x' }), RangeError)
})

test('une ligne imbriquée (onFail/onSuccess/onEmpty) n’exige pas de phase et ressort avec phase:null', () => {
  const line = normalizeNestedEffectLine({ type: 'modifier', target: 'actions', value: -1 }, 'onFail')
  assert.equal(line.phase, null)
  assert.equal(line.value, -1)
})

test('damage — cas nominal, locationMode:all ignore locations, forcedLocation inconnu rejeté', () => {
  const nominal = normalizeEffectLine({
    type: 'damage', phase: 'onTurn', formula: '1d6', locations: 1, locationMode: 'exposed',
    damageType: 'fire',
  })
  assert.equal(nominal.armorFactor, 1)
  assert.equal(nominal.remanence, 'none')

  const all = normalizeEffectLine({
    type: 'damage', phase: 'onTurn', formula: '3d10', locations: 5, locationMode: 'all', damageType: 'fire',
  })
  assert.equal(all.locations, null, 'locationMode:all ignore la valeur locations fournie')

  assert.throws(() => normalizeEffectLine({
    type: 'damage', phase: 'onTurn', formula: '1d6', damageType: 'fire', forcedLocation: 'aile_gauche',
  }), RangeError)

  assert.throws(() => normalizeEffectLine({ type: 'damage', phase: 'onTurn', locations: 1, damageType: 'fire' }), RangeError, 'formula obligatoire')
})

test('status — Z0 valide la forme du slug, pas son existence (vérifiée en Z1)', () => {
  const line = normalizeEffectLine({ type: 'status', phase: 'onTurn', statusCode: 'nimporte_quoi_pas_encore_au_registre' })
  assert.equal(line.statusCode, 'nimporte_quoi_pas_encore_au_registre')
  assert.throws(() => normalizeEffectLine({ type: 'status', phase: 'onTurn' }), RangeError)
})

test('modifier — value entier signé requis, sauf valueFromFailMargin', () => {
  const literal = normalizeEffectLine({ type: 'modifier', phase: 'onTurn', target: 'actions', value: -3 })
  assert.equal(literal.value, -3)
  assert.equal(literal.valueFromFailMargin, false)

  const dynamic = normalizeNestedEffectLine({
    type: 'modifier', target: 'actions', valueFromFailMargin: true, cumulative: true,
  }, 'onFail')
  assert.equal(dynamic.value, null)
  assert.equal(dynamic.cumulative, true)

  assert.throws(() => normalizeEffectLine({ type: 'modifier', phase: 'onTurn', target: 'actions', value: 1.5 }), RangeError)
  assert.throws(() => normalizeEffectLine({ type: 'modifier', phase: 'onTurn', value: 1 }), RangeError, 'target obligatoire')
})

test('note — label obligatoire, jamais d’escalade/rémanence (pas dans TRANSVERSE_TYPES)', () => {
  const line = normalizeEffectLine({ type: 'note', phase: 'onEnter', label: 'Attention', text: 'Sol glissant.' })
  assert.equal(line.remanence, undefined)
  assert.throws(() => normalizeEffectLine({ type: 'note', phase: 'onEnter' }), RangeError)
})

test('test — skill ou attribute requis, onFail imbriqué validé récursivement', () => {
  const line = normalizeEffectLine({
    type: 'test', phase: 'onTurn', skill: 'CON', difficulty: 0,
    onFail: { type: 'statLoss', stat: 'CON', amount: 1 },
  })
  assert.equal(line.onFail.stat, 'CON')
  assert.throws(() => normalizeEffectLine({ type: 'test', phase: 'onTurn', difficulty: 0 }), RangeError)
  assert.throws(() => normalizeEffectLine({
    type: 'test', phase: 'onTurn', skill: 'CON', onFail: { type: 'inconnu' },
  }), RangeError, 'un onFail invalide fait échouer tout le test')
})

test('statLoss / drainResource / accumulateLevel — formes minimales', () => {
  assert.deepEqual(
    normalizeEffectLine({ type: 'statLoss', phase: 'onTurn', stat: 'CON', amount: '1d3', recovery: 'lente' }),
    { type: 'statLoss', phase: 'onTurn', stat: 'CON', amount: '1d3', recovery: 'lente' },
  )
  const drain = normalizeEffectLine({ type: 'drainResource', phase: 'onTurn', resource: 'souffle', rate: 1 })
  assert.equal(drain.onEmpty, null)
  const accumulate = normalizeEffectLine({ type: 'accumulateLevel', phase: 'onEnter', track: 'irradiation', formula: '3d6' })
  assert.equal(accumulate.formula, '3d6')
})

test('chance — onSuccess/onFail optionnels, tous deux imbriqués sans phase', () => {
  const line = normalizeEffectLine({
    type: 'chance', phase: 'onTurn',
    onFail: { type: 'note', label: 'échec' },
  })
  assert.equal(line.onSuccess, null)
  assert.equal(line.onFail.phase, null)
})

test('skillOverride — swapTo requis seulement en mode swap', () => {
  assert.throws(() => normalizeEffectLine({ type: 'skillOverride', phase: 'onTurn', skill: 'CON', mode: 'swap' }), RangeError)
  const line = normalizeEffectLine({ type: 'skillOverride', phase: 'onTurn', skill: 'CON', mode: 'swap', swapTo: 'VOL' })
  assert.equal(line.swapTo, 'VOL')
  assert.throws(() => normalizeEffectLine({ type: 'skillOverride', phase: 'onTurn', skill: 'CON', mode: 'bogus' }), RangeError)
})

test('forcedMove — distance accepte un nombre non-entier (mètres) ou une formule', () => {
  const meters = normalizeEffectLine({ type: 'forcedMove', phase: 'onTurn', direction: 'awayFromCenter', distance: 1.5 })
  assert.equal(meters.distance, 1.5)
  const dice = normalizeEffectLine({ type: 'forcedMove', phase: 'onTurn', direction: 'awayFromCenter', distance: '1d3' })
  assert.equal(dice.distance, '1d3')
  assert.throws(() => normalizeEffectLine({ type: 'forcedMove', phase: 'onTurn', direction: 'x', distance: -1 }), RangeError)
})

test('corrodeEquipment — slotMode par défaut hit, rejette un mode inconnu', () => {
  const line = normalizeEffectLine({ type: 'corrodeEquipment', phase: 'onTurn', amount: 1 })
  assert.equal(line.slotMode, 'hit')
  assert.throws(() => normalizeEffectLine({ type: 'corrodeEquipment', phase: 'onTurn', slotMode: 'bogus', amount: 1 }), RangeError)
})

test('chain — accepte délai/geometrie sans accent en entrée, ressort toujours accentué', () => {
  const line = normalizeEffectLine({
    type: 'chain', phase: 'onExit', engendre: 'feu:petit', delai: 2, condition: 'humidité', geometrie: 'même volume',
  })
  assert.equal(line.délai, 2)
  assert.equal(line.géométrie, 'même volume')
  assert.throws(() => normalizeEffectLine({ type: 'chain', phase: 'onExit', engendre: 'x', delai: -1 }), RangeError)
})

test('escalation/remanence transverses — damage/status/modifier seulement', () => {
  const decay = normalizeEffectLine({
    type: 'modifier', phase: 'onTurn', target: 'actions', value: -1,
    escalation: { perTurn: 2, cap: 10 }, remanence: 'decay', remanenceParams: { perTurn: 1 },
  })
  assert.deepEqual(decay.escalation, { perTurn: 2, cap: 10 })
  assert.deepEqual(decay.remanenceParams, { perTurn: 1 })

  const fixed = normalizeEffectLine({
    type: 'damage', phase: 'onTurn', formula: '1d10', damageType: 'acid',
    remanence: 'fixed', remanenceParams: { turns: '1d6', earlyStop: 'neutralisant' },
  })
  assert.deepEqual(fixed.remanenceParams, { turns: '1d6', earlyStop: 'neutralisant' })

  assert.throws(() => normalizeEffectLine({
    type: 'modifier', phase: 'onTurn', target: 'actions', value: -1, remanence: 'inconnue',
  }), RangeError)
})

test('normalizeEffectLines — tableau requis, propage l’index dans le message d’erreur', () => {
  assert.throws(() => normalizeEffectLines({}), TypeError)
  assert.throws(() => normalizeEffectLines([{ type: 'note', phase: 'onTurn', label: 'ok' }, { type: 'bogus' }]), /effects\[1\]/)
})

test('normalizeAttenuation — key/tag synonymes, cost optionnel, by/effect fermés', () => {
  const byKey = normalizeAttenuation({ by: 'protectionKey', key: 'hazard:fire', effect: 'arbitrate' }, 'a')
  assert.equal(byKey.key, 'hazard:fire')
  assert.equal(byKey.cost, null)

  const byTag = normalizeAttenuation({ by: 'behavior', tag: 'holdBreath', effect: 'halve', cost: 'souffle' }, 'a')
  assert.equal(byTag.key, 'holdBreath', 'tag est un synonyme de key, jamais un 2e champ')
  assert.equal(byTag.cost, 'souffle')

  assert.throws(() => normalizeAttenuation({ by: 'bogus', key: 'x', effect: 'immune' }, 'a'), RangeError)
  assert.throws(() => normalizeAttenuation({ by: 'trait', key: 'x', effect: 'bogus' }, 'a'), RangeError)
  assert.deepEqual(normalizeAttenuations([]), [])
})

test('normalizeChainingRule — même forme qu’une ligne chain, réutilisée telle quelle', () => {
  const rule = normalizeChainingRule({ engendre: 'gaz:irritant', délai: 1, condition: 'porte ouverte' }, 'c')
  assert.equal(rule.engendre, 'gaz:irritant')
  assert.equal(rule.délai, 1)
  assert.deepEqual(normalizeChainingRules([]), [])
})

test('normalizeCorrodes — chaînes non vides, aucun vocabulaire fermé inventé', () => {
  assert.deepEqual(normalizeCorrodes(['chair', 'métal']), ['chair', 'métal'])
  assert.throws(() => normalizeCorrodes(['']), RangeError)
  assert.throws(() => normalizeCorrodes('chair'), TypeError)
})

test('les lignes normalisées sont gelées (deepFreeze), y compris leurs sous-objets', () => {
  const line = normalizeEffectLine({
    type: 'damage', phase: 'onTurn', formula: '1d6', damageType: 'fire',
    escalation: { perTurn: 1, cap: null },
  })
  assert.ok(Object.isFrozen(line))
  assert.ok(Object.isFrozen(line.escalation))
  assert.throws(() => { line.formula = '9d9' }, TypeError)
})
