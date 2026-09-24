import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WS } from '../../../shared/events.js'
import { buildDroneDamageNotice, DRONE_DESTROYED_DAMAGE } from './droneDamageNotice.js'

test('DRONE_DESTROYED_DAMAGE — 30 (LdB p.82-88)', () => {
  assert.equal(DRONE_DESTROYED_DAMAGE, 30)
})

test('blessure — clé droneDamaged avec gravité et intégrité avant → après', () => {
  const e = buildDroneDamageNotice({
    droneName: 'Drone AX', degatsNets: 12,
    outcome: { severity: 'moyenne', previousIntegrite: 5, newIntegrite: 4, detruit: false },
  })
  assert.equal(e.to, 'room')
  assert.equal(e.event, WS.COMBAT_SYSTEM_NOTICE)
  assert.equal(e.data.i18nKey, 'session.droneDamaged')
  assert.deepEqual(e.data.params, { drone: 'Drone AX', net: 12, severity: 'moyenne', from: 5, to: 4 })
  assert.ok(e.data.timestamp)
})

test('sous le premier seuil — clé droneDamagedNoWound, sans gravité', () => {
  const e = buildDroneDamageNotice({
    droneName: 'Drone AX', degatsNets: 3,
    outcome: { severity: null, previousIntegrite: 5, newIntegrite: 4, detruit: false },
  })
  assert.equal(e.data.i18nKey, 'session.droneDamagedNoWound')
  assert.deepEqual(e.data.params, { drone: 'Drone AX', net: 3, from: 5, to: 4 })
})

test('détruit — clé droneDestroyed, quelle que soit la gravité', () => {
  const e = buildDroneDamageNotice({
    droneName: 'Drone AX', degatsNets: 31,
    outcome: { severity: 'detruit', previousIntegrite: 5, newIntegrite: 0, detruit: true },
  })
  assert.equal(e.data.i18nKey, 'session.droneDestroyed')
  assert.deepEqual(e.data.params, { drone: 'Drone AX', net: 31, from: 5 })
  // Usure : intégrité tombée à 0 sans coup ≥ 30 — détruit quand même
  const wear = buildDroneDamageNotice({
    droneName: 'Drone AX', degatsNets: 12,
    outcome: { severity: 'moyenne', previousIntegrite: 1, newIntegrite: 0, detruit: true },
  })
  assert.equal(wear.data.i18nKey, 'session.droneDestroyed')
})

test('nom absent — « ? » plutôt qu’undefined', () => {
  const e = buildDroneDamageNotice({
    degatsNets: 3, outcome: { severity: null, previousIntegrite: 2, newIntegrite: 1, detruit: false },
  })
  assert.equal(e.data.params.drone, '?')
})
