import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getExoStandUpIneligibilityReasons, isExoStandUpEligible,
  isExclusiveDeclaration, getAoeExclusiveIneligibilityReasons, isAoeExclusiveEligible,
  getAimIneligibilityReasons, isAimEligible,
  getMultiShotIneligibilityReasons, isMultiShotEligible,
} from './combatExclusiveActions.js'

// PLAN_EXOARMURE.md Lot 2bis §9.2 — exclusivité tranchée par Saar (2026-08-18) : tenter de se
// relever bloque toute autre action déclarée ce Tour, réussite ou échec.
//
// PLAN_AOE.md §8 étape 7 (2026-08-26) : isExclusiveDeclaration/getAoeExclusiveIneligibilityReasons
// couvrent maintenant Tir de suppression et Lance-flammes — isAimEligible (Tir visé) reste hors
// périmètre de ce lot (déjà testé implicitement via ses propres appelants, pas de régression touchée
// ici).

test('getExoStandUpIneligibilityReasons — déclaration seule (rien d\'autre) : éligible', () => {
  assert.deepEqual(getExoStandUpIneligibilityReasons({ mapActions: {}, quick: {} }), [])
  assert.equal(isExoStandUpEligible({ mapActions: {}, quick: {} }), true)
})

test('getExoStandUpIneligibilityReasons — mapActions.move combiné : inéligible', () => {
  const reasons = getExoStandUpIneligibilityReasons({ mapActions: { move: { targetPosX: 1 } }, quick: {} })
  assert.deepEqual(reasons, ['déplacement'])
  assert.equal(isExoStandUpEligible({ mapActions: { move: { targetPosX: 1 } }, quick: {} }), false)
})

test('getExoStandUpIneligibilityReasons — tir/CaC combinés : les deux raisons remontent', () => {
  const reasons = getExoStandUpIneligibilityReasons({
    mapActions: { attack: [{ targetTokenId: 'a' }], melee: [{ targetTokenId: 'b' }] },
    quick: {},
  })
  assert.deepEqual(reasons, ['tir', 'corps à corps'])
})

test('getExoStandUpIneligibilityReasons — arrays vides (mapActions.attack/melee=[]) : jamais un faux positif', () => {
  assert.deepEqual(getExoStandUpIneligibilityReasons({ mapActions: { attack: [], melee: [] }, quick: {} }), [])
})

test('getExoStandUpIneligibilityReasons — interaction/rechargement/actions rapides combinés', () => {
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: { interact: true }, quick: {} }),
    ['interaction']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: { reload: true }, quick: {} }),
    ['rechargement']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: {}, quick: { observer: 1 } }),
    ['observation']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: {}, quick: { reperer: 1 } }),
    ['repérage']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: {}, quick: { phrase: 'À couvert !' } }),
    ['phrase prononcée']
  )
})

test('getExoStandUpIneligibilityReasons — mapActions/quick absents (undefined) : éligible, jamais un throw', () => {
  assert.deepEqual(getExoStandUpIneligibilityReasons({}), [])
})

// ─── isExclusiveDeclaration — Tir visé, Tir de suppression, Lance-flammes ────────────────────────

test('isExclusiveDeclaration — aucune condition remplie : non exclusif', () => {
  assert.deepEqual(isExclusiveDeclaration({ mapActions: {} }), { exclusive: false, reason: null })
})

test('isExclusiveDeclaration — Tir visé (aimTranches > 0), inchangé', () => {
  assert.deepEqual(
    isExclusiveDeclaration({ mapActions: { attack: [{ aimTranches: 2 }] } }),
    { exclusive: true, reason: 'tir_vise' },
  )
})

test('isExclusiveDeclaration — Tir de suppression (aoe.mode) déclenche l\'exclusivité, sans arme spécifique', () => {
  assert.deepEqual(
    isExclusiveDeclaration({ mapActions: { attack: [{ aoe: { mode: 'suppression', direction: 45 } }] } }),
    { exclusive: true, reason: 'tir_suppression' },
  )
})

test('isExclusiveDeclaration — Lance-flammes : exige AOE déclarée ET aoe_profile.mechanic === flamethrower, pas l\'un sans l\'autre', () => {
  const aoeAttack = { attack: [{ aoe: { direction: 10 } }] }
  const flamethrowerProfile = { shape: 'cone', mechanic: 'flamethrower' }
  assert.deepEqual(
    isExclusiveDeclaration({ mapActions: aoeAttack, weaponAoeProfile: flamethrowerProfile }),
    { exclusive: true, reason: 'lance_flammes' },
  )
  // Autre mécanisme AOE (fusil à pompe), pas de profil, ou aoe absente : jamais exclusif par erreur
  assert.equal(
    isExclusiveDeclaration({ mapActions: aoeAttack, weaponAoeProfile: { shape: 'ray', mechanic: 'shotgun_spread' } }).exclusive,
    false,
  )
  assert.equal(
    isExclusiveDeclaration({ mapActions: aoeAttack, weaponAoeProfile: null }).exclusive,
    false,
  )
  assert.equal(
    isExclusiveDeclaration({ mapActions: { attack: [{ targetTokenId: 'a' }] }, weaponAoeProfile: flamethrowerProfile }).exclusive,
    false,
  )
})

// ─── getAoeExclusiveIneligibilityReasons — interprétation stricte tranchée par Saar ──────────────

test('getAoeExclusiveIneligibilityReasons — déclaration seule : éligible', () => {
  assert.deepEqual(getAoeExclusiveIneligibilityReasons({ mapActions: {}, state: {}, quick: {}, entry: {} }), [])
  assert.equal(isAoeExclusiveEligible({ mapActions: {}, state: {}, quick: {}, entry: {} }), true)
})

test('getAoeExclusiveIneligibilityReasons — déplacement/CaC/actions rapides combinés : toutes les raisons remontent', () => {
  const reasons = getAoeExclusiveIneligibilityReasons({
    mapActions: { move: {}, melee: [{ targetTokenId: 'x' }] },
    state: {}, entry: {},
    quick: { observer: 1, phrase: 'Feu !' },
  })
  assert.deepEqual(reasons, ['déplacement', 'corps à corps', 'observation', 'phrase prononcée'])
})

test('getAoeExclusiveIneligibilityReasons — changement d\'état (posture) combiné : inéligible, contrairement au Tir visé qui a ses propres préconditions', () => {
  const reasons = getAoeExclusiveIneligibilityReasons({
    mapActions: {}, quick: {},
    state: { position: 'prone' }, entry: { state_position: 'standing' },
  })
  assert.deepEqual(reasons, ['changement de posture'])
})

test('getAoeExclusiveIneligibilityReasons — tir multiple (Tir Multi) exclu avec une action exclusive', () => {
  const reasons = getAoeExclusiveIneligibilityReasons({
    mapActions: { attack: [{ aoe: { direction: 0 } }, { targetTokenId: 'a' }] },
    state: {}, entry: {}, quick: {},
  })
  assert.deepEqual(reasons, ['tir multiple'])
})

// ─── getAimIneligibilityReasons — Tir visé (LdB p.227-228) ────────────────────────────────────────
// Ajouté 2026-08-28 avec le correctif du blocage signalé par Saar : les handleDeclare humanoïdes
// n'envoient pas `state.cover` → l'ancien `state.cover !== entry.state_cover` faisait
// `undefined !== 'exposed'` → "changement de couverture" systématique. Un champ absent = "inchangé".

const PNJ_ENTRY = {  // PNJ frais : arme au clair (COMBAT_START), reste au défaut
  state_position: 'standing', state_weapon: 'drawn', state_fire_mode: 'cc',
  state_cover: 'exposed', state_vitesse: 'normal',
}

test('getAimIneligibilityReasons — PNJ frais, payload sans `cover`, tir simple seul : éligible', () => {
  const reasons = getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 2 }] },
    // handleDeclare humanoïde : envoie position/weapon/fire_mode/vitesse, PAS cover
    state: { position: 'standing', weapon: 'drawn', fire_mode: 'cc', vitesse: 'normal' },
    quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1,
  })
  assert.deepEqual(reasons, [])
  assert.equal(isAimEligible({
    mapActions: { attack: [{ aimTranches: 2 }] },
    state: { position: 'standing', weapon: 'drawn', fire_mode: 'cc', vitesse: 'normal' },
    quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1,
  }), true)
})

test('getAimIneligibilityReasons — vrai changement de posture : bloqué', () => {
  const reasons = getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }] },
    state: { position: 'crouching', weapon: 'drawn', fire_mode: 'cc', vitesse: 'normal' },
    quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1,
  })
  assert.deepEqual(reasons, ['changement de posture'])
})

test('getAimIneligibilityReasons — vrai changement de couverture (si un jour envoyé) : bloqué', () => {
  const reasons = getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }] },
    state: { position: 'standing', weapon: 'drawn', fire_mode: 'cc', cover: 'important', vitesse: 'normal' },
    quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1,
  })
  assert.deepEqual(reasons, ['changement de couverture'])
})

test('getAimIneligibilityReasons — préconditions : arme pas au clair / pas en CC AVANT ce tour', () => {
  const reasons = getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }] },
    state: { position: 'standing', weapon: 'holstered', fire_mode: 'rc', vitesse: 'normal' },
    quick: {}, entry: { ...PNJ_ENTRY, state_weapon: 'holstered', state_fire_mode: 'rc' },
    isDualWield: false, bulletCount: 1,
  })
  assert.ok(reasons.includes('arme pas encore au clair'))
  assert.ok(reasons.includes('pas encore en coup par coup'))
})

test('getAimIneligibilityReasons — autres actions : tir multiple / déplacement / rafale / dual-wield', () => {
  assert.ok(getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }, { aimTranches: 1 }] },
    state: {}, quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1,
  }).includes('tir multiple'))
  assert.ok(getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }], move: { targetPosX: 1 } },
    state: { position: 'standing', weapon: 'drawn', fire_mode: 'cc', vitesse: 'normal' },
    quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1,
  }).includes('déplacement'))
  assert.ok(getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }] },
    state: {}, quick: {}, entry: PNJ_ENTRY, isDualWield: true, bulletCount: 1,
  }).includes('deux armes'))
  assert.ok(getAimIneligibilityReasons({
    mapActions: { attack: [{ aimTranches: 1 }] },
    state: {}, quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 3,
  }).includes('tir non simple (répétition ou rafale)'))
})

test('getAimIneligibilityReasons — zone d\'effet active : Tir visé inéligible (PLAN_AOE.md §8 étape 9)', () => {
  const reasons = getAimIneligibilityReasons({
    mapActions: { attack: [{ aoe: { direction: 45 } }] },
    state: {}, quick: {}, entry: PNJ_ENTRY, isDualWield: false, bulletCount: 1, isAoeMode: true,
  })
  assert.deepEqual(reasons, ['zone d\'effet active'])
})

// ─── getMultiShotIneligibilityReasons — Tir Multi (docs/PLAN_TIRMULTI.md D6/D10) ──────────────────

test('getMultiShotIneligibilityReasons — rien d\'actif : éligible', () => {
  assert.deepEqual(getMultiShotIneligibilityReasons({ currentFireMode: 'CC' }), [])
  assert.equal(isMultiShotEligible({ currentFireMode: 'CC' }), true)
})

test('getMultiShotIneligibilityReasons — rafale (RC/RL) / Tir visé / dual-wield / localisation : chacun exclut', () => {
  assert.deepEqual(getMultiShotIneligibilityReasons({ currentFireMode: 'RC' }), ['rafale (RC/RL)'])
  assert.deepEqual(getMultiShotIneligibilityReasons({ currentFireMode: 'CC', aimTranches: 2 }), ['tir visé actif'])
  assert.deepEqual(getMultiShotIneligibilityReasons({ currentFireMode: 'CC', isDualWield: true }), ['deux armes actif'])
  assert.deepEqual(getMultiShotIneligibilityReasons({ currentFireMode: 'CC', aimedLocation: 'head' }), ['localisation visée active'])
})

// Pas de réciproque "getAoeTargetingIneligibilityReasons" — le Klauss n'a aucun mode de tir normal
// (RAW : dispersion obligatoire, jamais un choix), Zone d'effet n'est donc pas un raffinement optionnel
// à arbitrer contre Tir Multi/Tir visé comme les autres : AssaultRangedPanel.jsx n'affiche même plus
// ces sections quand l'arme équipée est éligible (retour Saar, corrigeant l'hypothèse "Zone = option"
// de la version précédente de ce fichier).
