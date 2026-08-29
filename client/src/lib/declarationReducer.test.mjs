// declarationReducer.test.mjs — reducer d'état de déclaration de combat + snapFromRosterEntry.
// Ajouté 2026-08-28 avec le correctif du bug Tir visé (re-sync état au nouveau tour).
import test from 'node:test'
import assert from 'node:assert/strict'

import { declarationReducer, DECLARATION_INITIAL, snapFromRosterEntry } from './declarationReducer.js'

test('snapFromRosterEntry — entry null → tous les défauts', () => {
  assert.deepEqual(snapFromRosterEntry(null), {
    position: 'standing', weapon: 'holstered', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal',
  })
})

test('snapFromRosterEntry — reprend les state_* du roster', () => {
  assert.deepEqual(
    snapFromRosterEntry({
      state_position: 'crouching', state_weapon: 'drawn', state_fire_mode: 'rc',
      state_cover: 'important', state_vitesse: 'rushed',
    }),
    { position: 'crouching', weapon: 'drawn', fire_mode: 'rc', cover: 'important', vitesse: 'rushed' },
  )
})

test('snapFromRosterEntry — champ manquant → défaut de ce champ seulement', () => {
  const snap = snapFromRosterEntry({ state_weapon: 'drawn', state_fire_mode: 'rl' })
  assert.equal(snap.weapon, 'drawn')
  assert.equal(snap.fire_mode, 'rl')
  assert.equal(snap.position, 'standing')
})

test('RESET — re-seede l\'état tactique depuis le payload (roster frais), combatMode+quick remis à zéro', () => {
  const dirty = {
    position: 'prone', weapon: 'drawn', fire_mode: 'rl', cover: 'important', vitesse: 'rushed',
    combatMode: 'charge', quick: { observer: 3, reperer: 1, phrase: true },
  }
  const snap = snapFromRosterEntry({ state_position: 'standing', state_weapon: 'drawn', state_fire_mode: 'cc' })
  const next = declarationReducer(dirty, { type: 'RESET', payload: snap })
  assert.deepEqual(next, {
    ...DECLARATION_INITIAL,
    position: 'standing', weapon: 'drawn', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal',
  })
  // Régression bug Tir visé : `decl` suit le roster, il ne garde pas la valeur "sale" du tour d'avant.
  assert.equal(next.position, 'standing') // = snap (le roster disait standing)
  assert.equal(next.cover, 'exposed')     // = défaut du snap (endTurn a reseté state_cover)
  assert.equal(next.vitesse, 'normal')    // = défaut du snap (endTurn a reseté state_vitesse)
  assert.equal(next.combatMode, 'normal') // = DECLARATION_INITIAL
})

test('RESET — posture conservée entre tours : le client suit le roster, il ne force pas "standing"', () => {
  // endTurn (socketCombatHelpers.js) réinitialise state_cover/state_vitesse/state_combat_mode +
  // initiative, JAMAIS state_position (se relever a un coût d'Initiative dédié — COMBAT_FLUX.md
  // § endTurn, PLAN_CHARACTER_STATES §0.2). Un personnage couché au tour N reste couché au tour N+1 :
  // RESET doit reprendre `prone` depuis le roster, pas le remettre debout.
  const dirty = {
    position: 'crouching', weapon: 'drawn', fire_mode: 'cc', cover: 'important', vitesse: 'rushed',
    combatMode: 'offensif', quick: { observer: 1, reperer: 0, phrase: false },
  }
  const snap = snapFromRosterEntry({ state_position: 'prone', state_weapon: 'drawn', state_fire_mode: 'cc' })
  const next = declarationReducer(dirty, { type: 'RESET', payload: snap })
  assert.equal(next.position, 'prone')   // suit le roster (posture gardée par le serveur)
  assert.equal(next.cover, 'exposed')    // roster reseté → défaut
  assert.equal(next.vitesse, 'normal')   // roster reseté → défaut
  assert.equal(next.combatMode, 'normal')
})

test('SET_FIELD / SET_COMBAT_MODE / SELECT_ATTACK / SET_QUICK', () => {
  let s = declarationReducer(DECLARATION_INITIAL, { type: 'SET_FIELD', key: 'position', value: 'prone' })
  assert.equal(s.position, 'prone')
  s = declarationReducer(s, { type: 'SET_COMBAT_MODE', mode: 'offensif' })
  assert.equal(s.combatMode, 'offensif')
  s = declarationReducer(s, { type: 'SELECT_ATTACK' })
  assert.equal(s.weapon, 'drawn')
  s = declarationReducer(s, { type: 'SET_QUICK', key: 'observer', value: 2 })
  assert.equal(s.quick.observer, 2)
  assert.equal(s.quick.reperer, 0)
})

test('action inconnue → state inchangé (référence identique)', () => {
  const s = { ...DECLARATION_INITIAL }
  assert.equal(declarationReducer(s, { type: 'NOPE' }), s)
})
