import test from 'node:test'
import assert from 'node:assert/strict'

import { buildHumanDeclarePayload } from './buildDeclarePayload.js'

// Golden master — fige l'assemblage du payload COMBAT_ACTION_DECLARE (humain/PJ) tel que
// CombatActionWindow.jsx#handleDeclare le produisait avant l'extraction (module 0,
// PLAN_RW_DECLARE_DESIGN §5.4). Toute évolution de règle = un test mis à jour explicitement.

const baseDecl = () => ({
  position: 'standing', weapon: 'holstered', fire_mode: 'cc', cover: 'exposed',
  vitesse: 'normal', combatMode: 'normal',
  quick: { observer: 0, reperer: 0, phrase: false },
})

const baseSel = (over = {}) => ({
  tokenId: 'tok-1',
  decl: baseDecl(),
  moveSelection: null,
  attackSelected: false, assaultPendingTokenIds: [], effectiveAssaultCount: 1, assaultWeaponId: null,
  isDualWield: false, hasTwoWeapons: false, sameFirMode: false, weaponMg: null,
  currentVariant: null, dualWieldBonusComp: 0,
  aimTranches: 0, aimedLocation: null,
  meleeSelected: false, meleeDefensif: false, meleePendingTokenIds: [], effectiveMeleeCount: 1,
  effectiveMeleeWeaponId: null, effectiveMeleeNaturalWeaponId: null,
  effectiveDualWieldMelee: false, meleeOffhandWeapon: null,
  reloadSelected: false, selectedWeapon: null, selectedAmmoId: null,
  ...over,
})

const emptyState = { position: 'standing', weapon: 'holstered', fire_mode: 'cc', vitesse: 'normal', combat_mode: 'normal' }
const emptyQuick = { observer: 0, reperer: 0, phrase: false }
const ccVariant = { bulletCount: 1, bonusComp: 0, bonusDmg: 0 }

test('tour vide (Passer le tour) — aucune action, état par défaut', () => {
  assert.deepEqual(buildHumanDeclarePayload(baseSel()), {
    tokenId: 'tok-1',
    state: emptyState,
    mapActions: { move: null, attack: null, melee: null, reload: false },
    quick: emptyQuick,
  })
})

test('Tir simple — 1 cible, variant CC', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['enemy-1'], assaultWeaponId: 'wpn-1',
    currentVariant: ccVariant,
  }))
  assert.deepEqual(p.mapActions.attack, [{
    weaponInvId: 'wpn-1', offhandWeaponInvId: null, targetTokenId: 'enemy-1',
    bulletCount: 1, fireModeBonusComp: 0, fireModeBonusDmg: 0,
    isDualWield: false, dualWieldBonusComp: 0, aimTranches: 0, aimedLocation: null,
  }])
  assert.equal(p.mapActions.melee, null)
  assert.equal(p.mapActions.reload, false)
})

test('Tir Multi — 3 tirs, même arme, cibles distinctes', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['e1', 'e2', 'e3'], effectiveAssaultCount: 3,
    assaultWeaponId: 'wpn-1', currentVariant: { bulletCount: 1, bonusComp: 2, bonusDmg: 0 },
  }))
  assert.equal(p.mapActions.attack.length, 3)
  assert.deepEqual(p.mapActions.attack.map(a => a.targetTokenId), ['e1', 'e2', 'e3'])
  assert.deepEqual(p.mapActions.attack.map(a => a.weaponInvId), ['wpn-1', 'wpn-1', 'wpn-1'])
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, 2)
})

test('Tir Multi — assaultPendingTokenIds plus long que effectiveAssaultCount → tronqué', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['e1', 'e2', 'e3'], effectiveAssaultCount: 2,
    assaultWeaponId: 'w', currentVariant: ccVariant,
  }))
  assert.equal(p.mapActions.attack.length, 2)
})

test('Tir visé — aimTranches et aimedLocation propagés', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['e1'], assaultWeaponId: 'w',
    currentVariant: ccVariant, aimTranches: 2, aimedLocation: 'head',
  }))
  assert.equal(p.mapActions.attack[0].aimTranches, 2)
  assert.equal(p.mapActions.attack[0].aimedLocation, 'head')
})

test('Dual-wield Tir — offhand + bonus comp cumulé', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['e1'], assaultWeaponId: 'md-1',
    isDualWield: true, hasTwoWeapons: true, sameFirMode: true, weaponMg: { id: 'mg-1' },
    dualWieldBonusComp: 3, currentVariant: { bulletCount: 1, bonusComp: 0, bonusDmg: 0 },
  }))
  assert.equal(p.mapActions.attack[0].offhandWeaponInvId, 'mg-1')
  assert.equal(p.mapActions.attack[0].isDualWield, true)
  assert.equal(p.mapActions.attack[0].dualWieldBonusComp, 3)
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, 3) // 0 (variant) + 3 (dual-wield)
})

test('Dual-wield Tir — hasTwoWeapons false → offhand null, bonus non cumulé', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['e1'], assaultWeaponId: 'w',
    isDualWield: true, hasTwoWeapons: false, sameFirMode: true, weaponMg: { id: 'mg-1' },
    dualWieldBonusComp: 0, currentVariant: { bulletCount: 1, bonusComp: 1, bonusDmg: 0 },
  }))
  assert.equal(p.mapActions.attack[0].offhandWeaponInvId, null)
  assert.equal(p.mapActions.attack[0].isDualWield, false)
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, 1)
})

test('Tir sans variant configuré — bonus/bulletCount à null', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultPendingTokenIds: ['e1'], assaultWeaponId: 'w', currentVariant: null,
  }))
  assert.equal(p.mapActions.attack[0].bulletCount, null)
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, null)
  assert.equal(p.mapActions.attack[0].fireModeBonusDmg, null)
})

test('Corps à corps — arme d\'inventaire', () => {
  const p = buildHumanDeclarePayload(baseSel({
    meleeSelected: true, meleePendingTokenIds: ['e1'], effectiveMeleeWeaponId: 'm1',
  }))
  assert.deepEqual(p.mapActions.melee, [{
    targetTokenId: 'e1', weaponInvId: 'm1', naturalWeaponCharMutationId: null,
    offhandWeaponInvId: null, isDualWield: false,
  }])
  assert.equal(p.mapActions.attack, null)
})

test('Corps à corps — arme naturelle (mutation)', () => {
  const p = buildHumanDeclarePayload(baseSel({
    meleeSelected: true, meleePendingTokenIds: ['e1'], effectiveMeleeNaturalWeaponId: 'mut-1',
  }))
  assert.equal(p.mapActions.melee[0].weaponInvId, null)
  assert.equal(p.mapActions.melee[0].naturalWeaponCharMutationId, 'mut-1')
})

test('Corps à corps défensif — mode passif, pas de cible envoyée', () => {
  const p = buildHumanDeclarePayload(baseSel({
    meleeSelected: true, meleeDefensif: true, meleePendingTokenIds: ['e1'],
    decl: { ...baseDecl(), combatMode: 'defensif' },
  }))
  assert.equal(p.mapActions.melee, null)
  assert.equal(p.state.combat_mode, 'defensif')
})

test('Dual-wield Corps à corps — offhand + isDualWield', () => {
  const p = buildHumanDeclarePayload(baseSel({
    meleeSelected: true, meleePendingTokenIds: ['e1'], effectiveMeleeWeaponId: 'm1',
    effectiveDualWieldMelee: true, meleeOffhandWeapon: { id: 'off-1' },
  }))
  assert.equal(p.mapActions.melee[0].offhandWeaponInvId, 'off-1')
  assert.equal(p.mapActions.melee[0].isDualWield, true)
})

test('Rechargement — arme + munitions', () => {
  const p = buildHumanDeclarePayload(baseSel({
    reloadSelected: true, selectedWeapon: { id: 'w1' }, selectedAmmoId: 'ammo-1',
  }))
  assert.deepEqual(p.mapActions.reload, { weapon_inv_id: 'w1', ammo_item_id: 'ammo-1' })
})

test('Rechargement — arme absente → weapon_inv_id null', () => {
  const p = buildHumanDeclarePayload(baseSel({
    reloadSelected: true, selectedWeapon: null, selectedAmmoId: null,
  }))
  assert.deepEqual(p.mapActions.reload, { weapon_inv_id: null, ammo_item_id: null })
})

test('Déplacement normal — payload move complet', () => {
  const p = buildHumanDeclarePayload(baseSel({
    moveSelection: { targetPosX: 5, targetPosY: 3, targetPosZ: 0, ini_mod: -5, action_key: 'move_moyenne' },
  }))
  assert.deepEqual(p.mapActions.move, {
    targetPosX: 5, targetPosY: 3, targetPosZ: 0, ini_mod: -5, action_key: 'move_moyenne',
  })
})

test('Déplacement en Charge — ini_mod forcé à 0', () => {
  const p = buildHumanDeclarePayload(baseSel({
    moveSelection: { targetPosX: 1, targetPosY: 1, targetPosZ: 0, ini_mod: -3, action_key: 'move_lente' },
    decl: { ...baseDecl(), combatMode: 'charge' },
  }))
  assert.equal(p.mapActions.move.ini_mod, 0)
  assert.equal(p.state.combat_mode, 'charge')
})

test('Déplacement en Retraite — ini_mod forcé à 0', () => {
  const p = buildHumanDeclarePayload(baseSel({
    moveSelection: { targetPosX: 1, targetPosY: 1, targetPosZ: 0, ini_mod: -7, action_key: 'move_rapide' },
    decl: { ...baseDecl(), combatMode: 'retraite' },
  }))
  assert.equal(p.mapActions.move.ini_mod, 0)
})

test('Déplacement — targetPosZ absent → 0', () => {
  const p = buildHumanDeclarePayload(baseSel({
    moveSelection: { targetPosX: 1, targetPosY: 2, ini_mod: -5, action_key: 'move_moyenne' },
  }))
  assert.equal(p.mapActions.move.targetPosZ, 0)
})

test('Actions rapides — observer / reperer / phrase', () => {
  const p = buildHumanDeclarePayload(baseSel({
    decl: { ...baseDecl(), quick: { observer: 2, reperer: 1, phrase: true } },
  }))
  assert.deepEqual(p.quick, { observer: 2, reperer: 1, phrase: true })
})

test('État tactique changé — posture/vitesse/arme/mode de tir', () => {
  const p = buildHumanDeclarePayload(baseSel({
    decl: { ...baseDecl(), position: 'prone', vitesse: 'rushed', weapon: 'drawn', fire_mode: 'rl' },
  }))
  assert.deepEqual(p.state, {
    position: 'prone', weapon: 'drawn', fire_mode: 'rl', vitesse: 'rushed', combat_mode: 'normal',
  })
})

test('tokenId propagé tel quel', () => {
  const p = buildHumanDeclarePayload(baseSel({ tokenId: 'un-autre-token' }))
  assert.equal(p.tokenId, 'un-autre-token')
})
