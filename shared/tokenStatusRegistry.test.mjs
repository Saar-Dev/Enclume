import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TOKEN_STATUS_REGISTRY, TOKEN_STATUS_CATEGORY_COLORS, findTokenStatus,
  MANUAL_TOGGLE_STATUS_CODES, PANEL_STATUSES, DECLARATION_BLOCKING_STATUS_CODES,
  DEFENSELESS_STATUS_CODES, COMBAT_END_CLEARED_STATUS_CODES,
} from './tokenStatusRegistry.js'
import { ENVIRONMENTAL_HAZARD_REGISTRY } from './environmentalHazardRegistry.js'

// INSTANTANÉ HISTORIQUE (2026-09-24) — les littéraux qui existaient avant le registre, recopiés à la
// main depuis le code d'alors. Le commit qui a introduit le registre ne devait changer AUCUN
// comportement : ce test le prouve. Un futur statut (ex. `dead`) modifie ces attentes volontairement,
// dans le diff du commit qui l'ajoute — jamais en silence.
const AVANT = {
  // socketToken.js — VALID_STATUS_CODES
  basculeManuelle: [
    'grappled', 'restrained', 'off_balance', 'asphyxia', 'electrocuted',
    'stunned', 'unconscious', 'blinded', 'hypothermia', 'infected', 'poisoned', 'irradiated',
  ],
  // TokenStatusPanel.jsx — STATUS_LIST (ordre = ordre d'affichage)
  panneau: [
    ['grappled', 'entrave'], ['restrained', 'entrave'], ['off_balance', 'entrave'],
    ['burning', 'dot'], ['acid', 'dot'], ['asphyxia', 'dot'], ['decompression', 'dot'], ['electrocuted', 'dot'],
    ['stunned', 'sens'], ['unconscious', 'sens'], ['blinded', 'sens'],
    ['hypothermia', 'chronique'], ['infected', 'chronique'], ['poisoned', 'chronique'], ['irradiated', 'chronique'],
  ],
  // TokenPresentation.jsx — STATUS_CATEGORY (16 codes, dont evanoui)
  categories: {
    grappled: 'entrave', restrained: 'entrave', off_balance: 'entrave',
    burning: 'dot', acid: 'dot', asphyxia: 'dot', decompression: 'dot', electrocuted: 'dot',
    stunned: 'sens', unconscious: 'sens', blinded: 'sens', evanoui: 'sens',
    hypothermia: 'chronique', infected: 'chronique', poisoned: 'chronique', irradiated: 'chronique',
  },
  // TokenStatusPanel.jsx CATEGORY_COLOR et TokenPresentation.jsx STATUS_CATEGORY_COLOR (identiques)
  couleurs: { entrave: '#d8a838', dot: '#d84838', sens: '#9858c8', chronique: '#38a8c8' },
  // socketCombatResolution.js:165/353 (STUN2)
  bloqueDeclaration: ['stunned', 'unconscious'],
  // socketCombatHelpers.js:996 (isTargetDefenseless, DEF5)
  sansDefense: ['unconscious', 'blinded', 'stunned'],
  // socketCombatState.js:302/307 (nettoyage de fin de combat)
  nettoyeFinDeCombat: ['stunned', 'unconscious'],
}

const trie = (codes) => [...codes].sort()

test('bascule manuelle : mêmes codes que l\'ancienne liste serveur', () => {
  assert.deepEqual(trie(MANUAL_TOGGLE_STATUS_CODES), trie(AVANT.basculeManuelle))
})

test('panneau : mêmes codes, même catégorie, même ORDRE que l\'ancienne liste client', () => {
  assert.deepEqual(PANEL_STATUSES.map(s => [s.code, s.category]), AVANT.panneau)
})

test('catégories : chaque code de l\'ancienne table de présentation garde sa catégorie, et rien de plus', () => {
  const actuel = Object.fromEntries(TOKEN_STATUS_REGISTRY.map(s => [s.code, s.category]))
  assert.deepEqual(actuel, AVANT.categories)
})

test('couleurs de catégorie identiques aux deux anciennes copies client', () => {
  assert.deepEqual(TOKEN_STATUS_CATEGORY_COLORS, AVANT.couleurs)
})

test('ensembles de comportement : identiques aux anciens tableaux littéraux du moteur de combat', () => {
  assert.deepEqual(trie(DECLARATION_BLOCKING_STATUS_CODES), trie(AVANT.bloqueDeclaration))
  assert.deepEqual(trie(DEFENSELESS_STATUS_CODES), trie(AVANT.sansDefense))
  assert.deepEqual(trie(COMBAT_END_CLEARED_STATUS_CODES), trie(AVANT.nettoyeFinDeCombat))
})

test('invariants : codes uniques, chaque catégorie a une couleur, tout statut du panneau est affiché', () => {
  const codes = TOKEN_STATUS_REGISTRY.map(s => s.code)
  assert.equal(new Set(codes).size, codes.length, 'code dupliqué dans le registre')
  for (const entry of TOKEN_STATUS_REGISTRY) {
    assert.ok(TOKEN_STATUS_CATEGORY_COLORS[entry.category], `catégorie sans couleur : ${entry.code}`)
  }
  assert.ok(PANEL_STATUSES.every(s => TOKEN_STATUS_REGISTRY.includes(s)))
})

test('cohérence : un statut qui bloque la déclaration rend aussi sans défense (comportement actuel)', () => {
  for (const code of DECLARATION_BLOCKING_STATUS_CODES) {
    assert.ok(DEFENSELESS_STATUS_CODES.includes(code), `${code} bloque la déclaration mais n'est pas « sans défense »`)
  }
})

test('les dangers environnementaux sont dans le registre, hors bascule manuelle (exposeToHazard uniquement)', () => {
  for (const { code } of ENVIRONMENTAL_HAZARD_REGISTRY) {
    assert.ok(findTokenStatus(code), `danger absent du registre des statuts : ${code}`)
    assert.equal(MANUAL_TOGGLE_STATUS_CODES.includes(code), false, `${code} ne doit pas être basculable à nu`)
  }
})

test('recherche tolérante : un code inconnu (iem_survival, ati_*) renvoie undefined, jamais une erreur', () => {
  assert.equal(findTokenStatus('iem_survival'), undefined)
  assert.equal(findTokenStatus('ati_offensive'), undefined)
  assert.equal(findTokenStatus(undefined), undefined)
  assert.equal(findTokenStatus('stunned').category, 'sens')
})
