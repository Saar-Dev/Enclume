import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHumanDeclarePayload, buildGmDeclarePayload,
  buildDroneMapActions, buildExoMapActions,
} from './buildDeclarePayload.js'

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
  aimTranches: 0, aimedLocation: null, aoeDirection: null,
  meleeSelected: false, meleeDefensif: false, meleePendingTokenIds: [], effectiveMeleeCount: 1,
  effectiveMeleeWeaponId: null, effectiveMeleeNaturalWeaponId: null,
  effectiveDualWieldMelee: false, meleeOffhandWeapon: null,
  reloadSelected: false, selectedWeapon: null, selectedAmmoId: null,
  chargeSelection: null,
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

// ─── Zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9) ──────────────────────────────────────────

test('Zone d\'effet — une entrée sans cible, aoe.direction, dual-wield/Tir visé neutralisés', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultWeaponId: 'klauss-1', aoeDirection: 42,
    // Valeurs "sales" laissées par un mode précédent — ne doivent PAS fuiter dans le payload zone :
    // la reducer n'efface pas ces champs en entrant en mode zone, seuls aoeDirection/targets le sont.
    isDualWield: true, hasTwoWeapons: true, sameFirMode: true, weaponMg: { id: 'mg-1' }, dualWieldBonusComp: 3,
    aimTranches: 2, aimedLocation: 'head', currentVariant: { bulletCount: 2, bonusComp: 1, bonusDmg: 0 },
    assaultPendingTokenIds: ['stale-target'],
  }))
  assert.deepEqual(p.mapActions.attack, [{
    weaponInvId: 'klauss-1', offhandWeaponInvId: null, targetTokenId: null,
    aoe: { direction: 42 },
    bulletCount: null, fireModeBonusComp: null, fireModeBonusDmg: null,
    isDualWield: false, dualWieldBonusComp: 0, aimTranches: 0, aimedLocation: null,
  }])
})

test('Zone d\'effet — aoeDirection à 0° (falsy) reste bien traité comme une zone posée', () => {
  const p = buildHumanDeclarePayload(baseSel({
    attackSelected: true, assaultWeaponId: 'klauss-1', aoeDirection: 0,
  }))
  assert.equal(p.mapActions.attack.length, 1)
  assert.deepEqual(p.mapActions.attack[0].aoe, { direction: 0 })
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

test('Charge (M0.4-g) — move + cible viennent de chargeSelection, ini_mod 0, 1 attaque sans dual-wield', () => {
  const p = buildHumanDeclarePayload(baseSel({
    decl: { ...baseDecl(), combatMode: 'charge' },
    chargeSelection: {
      move: { targetPosX: 1, targetPosY: 1, targetPosZ: 0, ini_mod: 0, action_key: 'move_lente' },
      targetTokenId: 'e1',
    },
    effectiveMeleeWeaponId: 'm1',
  }))
  assert.equal(p.mapActions.move.ini_mod, 0)
  assert.equal(p.state.combat_mode, 'charge')
  assert.deepEqual(p.mapActions.melee, [{
    targetTokenId: 'e1', weaponInvId: 'm1', naturalWeaponCharMutationId: null,
    offhandWeaponInvId: null, isDualWield: false,
  }])
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

// ─── MJ / PNJ (buildGmDeclarePayload) ─────────────────────────────────────────
// Golden master — fige CombatGmDeclareWindow.jsx#handleDeclare branche PNJ. Différences légitimes
// vs l'humain PJ testées explicitement (fireModeBonus par défaut 0 vs null ; move brut ; weapon.inv_id).

const baseGmSel = (over = {}) => ({
  activeTokenId: 'pnj-1',
  decl: baseDecl(),
  pendingMove: null, chargeSelection: null,
  weapon: null, assaultTargets: [], effectiveAssaultCount: 1,
  isDualWield: false, hasTwoWeapons: false, sameFirMode: false, weaponMg: null,
  currentVariant: null, dualWieldBonusComp: 0,
  aimTranches: 0, aimedLocation: null, aoeDirection: null,
  meleeTargets: [], effectiveMeleeCount: 1, weaponInvIdForMelee: null, naturalWeaponIdForMelee: null,
  effectiveDualWieldMelee: false, meleeOffhandWeapon: null,
  mapAction: null,
  ...over,
})

test('GM — tour vide (PNJ Passe le tour)', () => {
  assert.deepEqual(buildGmDeclarePayload(baseGmSel()), {
    tokenId: 'pnj-1',
    state: emptyState,
    mapActions: { move: null, attack: null, melee: null, reload: false },
    quick: emptyQuick,
  })
})

test('GM — Tir simple PNJ (weapon.inv_id, variant CC)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    weapon: { inv_id: 'w-inv-1' }, assaultTargets: ['e1'], currentVariant: ccVariant,
  }))
  assert.deepEqual(p.mapActions.attack, [{
    weaponInvId: 'w-inv-1', offhandWeaponInvId: null, targetTokenId: 'e1',
    bulletCount: 1, fireModeBonusComp: 0, fireModeBonusDmg: 0,
    isDualWield: false, dualWieldBonusComp: 0, aimTranches: 0, aimedLocation: null,
  }])
})

test('GM — Tir sans variant → bonus à 0 (PAS null, différence assumée vs PJ)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    weapon: { inv_id: 'w' }, assaultTargets: ['e1'], currentVariant: null,
  }))
  assert.equal(p.mapActions.attack[0].bulletCount, null)
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, 0)
  assert.equal(p.mapActions.attack[0].fireModeBonusDmg, 0)
})

test('GM — Zone d\'effet — une entrée sans cible, aoe.direction, bonus à 0 (pas null, différence PJ)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    weapon: { inv_id: 'klauss-inv' }, aoeDirection: 17,
    isDualWield: true, hasTwoWeapons: true, sameFirMode: true, weaponMg: { inv_id: 'mg-inv' }, dualWieldBonusComp: 3,
    aimTranches: 2, aimedLocation: 'head', currentVariant: { bulletCount: 2, bonusComp: 1, bonusDmg: 0 },
    assaultTargets: ['stale-target'],
  }))
  assert.deepEqual(p.mapActions.attack, [{
    weaponInvId: 'klauss-inv', offhandWeaponInvId: null, targetTokenId: null,
    aoe: { direction: 17 },
    bulletCount: null, fireModeBonusComp: 0, fireModeBonusDmg: 0,
    isDualWield: false, dualWieldBonusComp: 0, aimTranches: 0, aimedLocation: null,
  }])
})

test('GM — Zone d\'effet sans arme → attack null (même garde que le Tir normal)', () => {
  const p = buildGmDeclarePayload(baseGmSel({ weapon: null, aoeDirection: 17 }))
  assert.equal(p.mapActions.attack, null)
})

test('GM — Zone d\'effet + Recharger → attack null (D7, même exclusivité que le Tir normal)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    weapon: { inv_id: 'klauss-inv' }, aoeDirection: 17, mapAction: 'reload',
  }))
  assert.equal(p.mapActions.attack, null)
  assert.equal(p.mapActions.reload, true)
})

test('GM — Tir avec cibles mais weapon null → attack null', () => {
  const p = buildGmDeclarePayload(baseGmSel({ weapon: null, assaultTargets: ['e1'] }))
  assert.equal(p.mapActions.attack, null)
})

test('GM — Tir Multi PNJ ×2', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    weapon: { inv_id: 'w' }, assaultTargets: ['e1', 'e2'], effectiveAssaultCount: 2,
    currentVariant: { bulletCount: 1, bonusComp: 2, bonusDmg: 0 },
  }))
  assert.equal(p.mapActions.attack.length, 2)
  assert.deepEqual(p.mapActions.attack.map(a => a.targetTokenId), ['e1', 'e2'])
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, 2)
})

test('GM — Dual-wield Tir PNJ (weaponMg.inv_id + bonus cumulé)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    weapon: { inv_id: 'md-inv' }, assaultTargets: ['e1'],
    isDualWield: true, hasTwoWeapons: true, sameFirMode: true, weaponMg: { inv_id: 'mg-inv' },
    dualWieldBonusComp: 3, currentVariant: { bulletCount: 1, bonusComp: 0, bonusDmg: 0 },
  }))
  assert.equal(p.mapActions.attack[0].offhandWeaponInvId, 'mg-inv')
  assert.equal(p.mapActions.attack[0].isDualWield, true)
  assert.equal(p.mapActions.attack[0].fireModeBonusComp, 3)
})

test('GM — Corps à corps PNJ (weaponInvIdForMelee)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    meleeTargets: ['e1'], weaponInvIdForMelee: 'm-inv',
  }))
  assert.deepEqual(p.mapActions.melee, [{
    targetTokenId: 'e1', weaponInvId: 'm-inv', naturalWeaponCharMutationId: null,
    offhandWeaponInvId: null, isDualWield: false,
  }])
})

test('GM — CaC PNJ arme naturelle', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    meleeTargets: ['e1'], naturalWeaponIdForMelee: 'mut-1',
  }))
  assert.equal(p.mapActions.melee[0].weaponInvId, null)
  assert.equal(p.mapActions.melee[0].naturalWeaponCharMutationId, 'mut-1')
})

test('GM — Charge PNJ (chargeSelection.move + entrée melee forme charge, sans offhand/isDualWield)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    chargeSelection: { move: { targetPosX: 2, targetPosY: 2, action_key: 'move_lente' }, targetTokenId: 'e1' },
    weaponInvIdForMelee: 'm', pendingMove: { targetPosX: 9, targetPosY: 9 },
  }))
  assert.deepEqual(p.mapActions.move, { targetPosX: 2, targetPosY: 2, action_key: 'move_lente' })
  assert.deepEqual(p.mapActions.melee, [{
    targetTokenId: 'e1', weaponInvId: 'm', naturalWeaponCharMutationId: null,
  }])
})

test('GM — Dual-wield CaC PNJ (meleeOffhandWeapon.inv_id)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    meleeTargets: ['e1'], weaponInvIdForMelee: 'm',
    effectiveDualWieldMelee: true, meleeOffhandWeapon: { inv_id: 'off-inv' },
  }))
  assert.equal(p.mapActions.melee[0].offhandWeaponInvId, 'off-inv')
  assert.equal(p.mapActions.melee[0].isDualWield, true)
})

test('GM — Rechargement PNJ (mapAction reload → true)', () => {
  const p = buildGmDeclarePayload(baseGmSel({ mapAction: 'reload' }))
  assert.equal(p.mapActions.reload, true)
})

test('GM — D7 : Recharger exclut le Tir même si une cible est posée', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    mapAction: 'reload',
    weapon: { inv_id: 'w1', ref_fire_mode: 'CC' },
    assaultTargets: ['e1'],
    effectiveAssaultCount: 1,
  }))
  assert.equal(p.mapActions.reload, true)
  assert.equal(p.mapActions.attack, null)
})

test('GM — Déplacement PNJ (pendingMove passé brut, pas de forçage ini_mod)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    pendingMove: { targetPosX: 5, targetPosY: 3, targetPosZ: 0, ini_mod: -5, action_key: 'move_moyenne' },
  }))
  assert.deepEqual(p.mapActions.move, {
    targetPosX: 5, targetPosY: 3, targetPosZ: 0, ini_mod: -5, action_key: 'move_moyenne',
  })
})

test('GM — chargeSelection.move prioritaire sur pendingMove', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    pendingMove: { targetPosX: 1, targetPosY: 1 },
    chargeSelection: { move: { targetPosX: 2, targetPosY: 2 }, targetTokenId: null },
  }))
  assert.deepEqual(p.mapActions.move, { targetPosX: 2, targetPosY: 2 })
})

test('GM — mode Défensif PNJ (state.combat_mode, melee reste null sans cible)', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    decl: { ...baseDecl(), combatMode: 'defensif' },
  }))
  assert.equal(p.state.combat_mode, 'defensif')
  assert.equal(p.mapActions.melee, null)
})

test('GM — actions rapides PNJ', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    decl: { ...baseDecl(), quick: { observer: 1, reperer: 2, phrase: true } },
  }))
  assert.deepEqual(p.quick, { observer: 1, reperer: 2, phrase: true })
})

test('GM — état tactique changé PNJ', () => {
  const p = buildGmDeclarePayload(baseGmSel({
    decl: { ...baseDecl(), position: 'kneeling', vitesse: 'delayed', weapon: 'ready', fire_mode: 'rc' },
  }))
  assert.deepEqual(p.state, {
    position: 'kneeling', weapon: 'ready', fire_mode: 'rc', vitesse: 'delayed', combat_mode: 'normal',
  })
})

// ─── Drone (buildDroneMapActions) ────────────────────────────────────────────
const droneSel = (over = {}) => ({
  selectedDroneWeaponId: null, assaultTargetId: null, droneWeapons: [], pendingMove: null, ...over,
})

test('drone — rien : stateFireMode cc, move null', () => {
  assert.deepEqual(buildDroneMapActions(droneSel()), {
    stateFireMode: 'cc',
    mapActions: { move: null },
  })
})

// CaC ⟺ ref_category === 'Arme de contact' (ticket DRONE-CC-MELEE-MISCLASS). `fire_mode`
// (CC/RC/RL) est un mode de tir, jamais un discriminant Tir/CaC.
test('drone — Tir (arme à distance, ref_category "Arme lourde") → stateFireMode rc, attack', () => {
  const r = buildDroneMapActions(droneSel({
    selectedDroneWeaponId: 'w1', assaultTargetId: 'e1',
    droneWeapons: [{ id: 'w1', ref_category: 'Arme lourde', fire_mode: 'rc', ref_fire_mode: 'RC' }],
  }))
  assert.equal(r.stateFireMode, 'rc')
  assert.deepEqual(r.mapActions, { move: null, attack: [{ droneWeaponInvId: 'w1', targetTokenId: 'e1' }] })
})

test('drone — CaC (ref_category "Arme de contact") → stateFireMode cc, melee', () => {
  const r = buildDroneMapActions(droneSel({
    selectedDroneWeaponId: 'w1', assaultTargetId: 'e1',
    droneWeapons: [{ id: 'w1', ref_category: 'Arme de contact' }],
  }))
  assert.equal(r.stateFireMode, 'cc')
  assert.deepEqual(r.mapActions, { move: null, melee: [{ droneWeaponInvId: 'w1', targetTokenId: 'e1' }] })
})

// Régression DRONE-CC-MELEE-MISCLASS : le Fusil Gauss (Arme lourde, mode de tir CC) était classé CaC
// → le serveur exigeait le programme armement_contact au lieu d'armement_distance.
test('drone — mode de tir "cc" (Coup par Coup) sur arme à distance → Tir, jamais CaC', () => {
  const r = buildDroneMapActions(droneSel({
    selectedDroneWeaponId: 'w1', assaultTargetId: 'e1',
    droneWeapons: [{ id: 'w1', fire_mode: 'cc', ref_category: 'Arme lourde', ref_fire_mode: 'CC', ref_range: '70/350/700/1400 (2 100)' }],
  }))
  assert.equal(r.stateFireMode, 'cc')
  assert.ok('attack' in r.mapActions)
  assert.ok(!('melee' in r.mapActions))
})

test('drone — mode de tir explicite "RL" → stateFireMode rl, attack', () => {
  const r = buildDroneMapActions(droneSel({
    selectedDroneWeaponId: 'w1', assaultTargetId: 'e1',
    droneWeapons: [{ id: 'w1', fire_mode: 'RL', ref_category: 'Arme lourde' }],
  }))
  assert.equal(r.stateFireMode, 'rl')
  assert.ok('attack' in r.mapActions)
})

test('drone — déplacement (move complet, pas d\'attaque)', () => {
  const r = buildDroneMapActions(droneSel({
    pendingMove: { targetPosX: 2, targetPosY: 3, targetPosZ: 0, ini_mod: -5, action_key: 'move_moyenne' },
  }))
  assert.deepEqual(r.mapActions, {
    move: { targetPosX: 2, targetPosY: 3, targetPosZ: 0, ini_mod: -5, action_key: 'move_moyenne' },
  })
})

test('drone — déplacement + Tir', () => {
  const r = buildDroneMapActions(droneSel({
    selectedDroneWeaponId: 'w1', assaultTargetId: 'e1',
    droneWeapons: [{ id: 'w1', ref_category: 'Arme lourde', ref_fire_mode: 'RC' }],
    pendingMove: { targetPosX: 1, targetPosY: 1, ini_mod: -3, action_key: 'move_lente' },
  }))
  assert.ok(r.mapActions.move)
  assert.deepEqual(r.mapActions.attack, [{ droneWeaponInvId: 'w1', targetTokenId: 'e1' }])
})

test('drone — pendingMove ini_mod/targetPosZ absents → 0', () => {
  const r = buildDroneMapActions(droneSel({
    pendingMove: { targetPosX: 1, targetPosY: 1, action_key: 'x' },
  }))
  assert.equal(r.mapActions.move.ini_mod, 0)
  assert.equal(r.mapActions.move.targetPosZ, 0)
})

test('drone — arme introuvable dans la liste → traité comme Tir (le serveur revalide l\'arme)', () => {
  const r = buildDroneMapActions(droneSel({
    selectedDroneWeaponId: 'ghost', assaultTargetId: 'e1', droneWeapons: [],
  }))
  assert.equal(r.stateFireMode, 'rc')
  assert.ok('attack' in r.mapActions)
})

// ─── Exo (buildExoMapActions) ────────────────────────────────────────────────
const exoSel = (over = {}) => ({
  selectedExoWeaponId: null, assaultTargetId: null, exoWeapons: [], ...over,
})

test('exo — rien sélectionné → {}', () => {
  assert.deepEqual(buildExoMapActions(exoSel()), {})
})

test('exo — arme sélectionnée sans cible → {}', () => {
  assert.deepEqual(buildExoMapActions(exoSel({ selectedExoWeaponId: 'w1' })), {})
})

test('exo — Tir (arme à distance)', () => {
  const r = buildExoMapActions(exoSel({
    selectedExoWeaponId: 'w1', assaultTargetId: 'e1',
    exoWeapons: [{ id: 'w1', ref_category: 'Fusil' }],
  }))
  assert.deepEqual(r, { attack: [{ exoWeaponInvId: 'w1', targetTokenId: 'e1' }] })
})

test('exo — CaC (Arme de contact)', () => {
  const r = buildExoMapActions(exoSel({
    selectedExoWeaponId: 'w1', assaultTargetId: 'e1',
    exoWeapons: [{ id: 'w1', ref_category: 'Arme de contact' }],
  }))
  assert.deepEqual(r, { melee: [{ exoWeaponInvId: 'w1', targetTokenId: 'e1' }] })
})

test('exo — arme introuvable → Tir par défaut (isCaC false)', () => {
  const r = buildExoMapActions(exoSel({
    selectedExoWeaponId: 'ghost', assaultTargetId: 'e1', exoWeapons: [],
  }))
  assert.deepEqual(r, { attack: [{ exoWeaponInvId: 'ghost', targetTokenId: 'e1' }] })
})
