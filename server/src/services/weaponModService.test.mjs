import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveModHooks, getAllModStatusCodes } from './weaponModService.js'
import { WEAPON_MOD_REGISTRY } from '../../../shared/weaponModRegistry.js'

// WEAPON_MOD_REGISTRY est un tableau exporté mutable, désormais peuplé par Phase 4 (ati/memoire/
// projecteur, réel). Tout test qui a besoin d'un registre mock doit sauvegarder puis restaurer le
// contenu réel — jamais un simple `.length = 0`, qui effacerait définitivement les entrées réelles
// pour le reste de la suite.
function withRegistry(mockEntries, fn) {
  const original = [...WEAPON_MOD_REGISTRY]
  WEAPON_MOD_REGISTRY.length = 0
  WEAPON_MOD_REGISTRY.push(...mockEntries)
  return (async () => {
    try {
      return await fn()
    } finally {
      WEAPON_MOD_REGISTRY.length = 0
      WEAPON_MOD_REGISTRY.push(...original)
    }
  })()
}

// mod_key garanti sans entrée réelle (jamais 'ati'/'memoire'/'projecteur'/'lunette', tous réels
// depuis Phase 4) — pour tester le chemin "aucun handler enregistré", pas un vrai mod.
const UNKNOWN_MOD_KEY = 'inconnu_jamais_dans_le_registre'

test('mod_key sans entrée registre -> onDeclare neutre', async () => {
  const result = await resolveModHooks([{ mod_key: UNKNOWN_MOD_KEY, state: null }], 'onDeclare', {})
  assert.deepEqual(result, { iniCostDelta: 0, bonusComp: 0 })
})

test('mod_key sans entrée registre -> onCalculateModifiers neutre', async () => {
  const result = await resolveModHooks([{ mod_key: UNKNOWN_MOD_KEY, state: null }], 'onCalculateModifiers', {})
  assert.deepEqual(result, { bonusAttaque: 0, bonusDefense: 0, breakdowns: [] })
})

test('mod_key sans entrée registre -> onBeforeAttack neutre, jamais blocked', async () => {
  const result = await resolveModHooks([{ mod_key: UNKNOWN_MOD_KEY, state: null }], 'onBeforeAttack', {})
  assert.deepEqual(result, { blocked: false, reason: null, adjustedModifiers: null })
})

test('un mod sans mod_key (NULL) est ignoré, jamais une erreur', async () => {
  const result = await resolveModHooks([{ mod_key: null, state: null }], 'onCalculateModifiers', {})
  assert.deepEqual(result, { bonusAttaque: 0, bonusDefense: 0, breakdowns: [] })
})

test('hook inconnu -> throw explicite (pas un no-op silencieux qui masquerait une faute de frappe)', async () => {
  await assert.rejects(() => resolveModHooks([], 'onSomethingElse', {}))
})

test('le registre réel contient ati/memoire/projecteur (Phase 4)', () => {
  const keys = WEAPON_MOD_REGISTRY.map(e => e.key).sort()
  assert.deepEqual(keys, ['ati', 'memoire', 'projecteur'])
})

test('onCalculateModifiers — additionne plusieurs mods actifs, breakdowns dans l’ordre de priority', () => withRegistry(
  [
    { key: 'mockA', priority: 10, hooks: { onCalculateModifiers: async () => ({ bonusAttaque: 3, breakdowns: [{ name: 'A', value: 3 }] }) } },
    { key: 'mockB', priority: 20, hooks: { onCalculateModifiers: async () => ({ bonusAttaque: 2, breakdowns: [{ name: 'B', value: 2 }] }) } },
  ],
  async () => {
    const result = await resolveModHooks(
      [{ mod_key: 'mockB', state: null }, { mod_key: 'mockA', state: null }],
      'onCalculateModifiers',
      {},
    )
    assert.equal(result.bonusAttaque, 5)
    assert.deepEqual(result.breakdowns.map(b => b.name), ['A', 'B'])
  },
))

test('onCalculateModifiers — modLevel injecté par mod (mod.bonus), pas un champ global partagé', () => withRegistry(
  [
    { key: 'mockA', priority: 10, hooks: { onCalculateModifiers: async (_state, ctx) => ({ bonusAttaque: ctx.modLevel }) } },
    { key: 'mockB', priority: 20, hooks: { onCalculateModifiers: async (_state, ctx) => ({ bonusAttaque: ctx.modLevel }) } },
  ],
  async () => {
    const result = await resolveModHooks(
      [{ mod_key: 'mockA', bonus: 3, state: null }, { mod_key: 'mockB', bonus: 7, state: null }],
      'onCalculateModifiers',
      {},
    )
    assert.equal(result.bonusAttaque, 10) // 3 + 7, jamais 7 + 7 ou 3 + 3
  },
))

test('onBeforeAttack — un mod bloquant arrête la chaîne, le suivant (priority plus haute) n’est jamais appelé', () => {
  let secondCalled = false
  return withRegistry(
    [
      { key: 'mockA', priority: 10, hooks: { onBeforeAttack: async () => ({ blocked: true, reason: 'cible amie' }) } },
      { key: 'mockB', priority: 20, hooks: { onBeforeAttack: async () => { secondCalled = true; return { blocked: false } } } },
    ],
    async () => {
      const result = await resolveModHooks(
        [{ mod_key: 'mockB', state: null }, { mod_key: 'mockA', state: null }],
        'onBeforeAttack',
        {},
      )
      assert.equal(result.blocked, true)
      assert.equal(result.reason, 'cible amie')
      assert.equal(secondCalled, false)
    },
  )
})

test('onBeforeAttack — adjustedModifiers d’un mod est visible par le suivant (priority croissante)', () => {
  let receivedContext = null
  return withRegistry(
    [
      { key: 'mockA', priority: 10, hooks: { onBeforeAttack: async () => ({ blocked: false, adjustedModifiers: { malusMouvement: -2 } }) } },
      { key: 'mockB', priority: 20, hooks: { onBeforeAttack: async (_state, context) => { receivedContext = context; return { blocked: false } } } },
    ],
    async () => {
      await resolveModHooks(
        [{ mod_key: 'mockB', state: null }, { mod_key: 'mockA', state: null }],
        'onBeforeAttack',
        {},
      )
      assert.deepEqual(receivedContext.adjustedModifiers, { malusMouvement: -2 })
    },
  )
})

test('rollDice est injecté dans le contexte (Phase 3), basé sur parseDice — un vrai jet, pas un mock', () => {
  let receivedRollDice = null
  return withRegistry(
    [{ key: 'mockA', priority: 10, hooks: { onTurnStart: async (_state, context) => { receivedRollDice = context.rollDice; return {} } } }],
    async () => {
      await resolveModHooks([{ mod_key: 'mockA', state: null }], 'onTurnStart', {})
      assert.equal(typeof receivedRollDice, 'function')
      const roll = await receivedRollDice('1d20')
      assert.ok(roll.total >= 1 && roll.total <= 20)
      assert.equal(roll.rolls.length, 1)
    },
  )
})

test('getAllModStatusCodes — agrège statusCodes de toutes les entrées, ignore les entrées sans le champ', () => withRegistry(
  [
    { key: 'mockA', priority: 10, hooks: {}, statusCodes: ['mockA_on', 'mockA_off'] },
    { key: 'mockB', priority: 20, hooks: {} },
  ],
  () => {
    assert.deepEqual(getAllModStatusCodes(), ['mockA_on', 'mockA_off'])
  },
))

test('getAllModStatusCodes — registre réel (Phase 4) contient au moins les codes ATI', () => {
  assert.ok(getAllModStatusCodes().includes('ati_offensive'))
  assert.ok(getAllModStatusCodes().includes('ati_defensive'))
})
