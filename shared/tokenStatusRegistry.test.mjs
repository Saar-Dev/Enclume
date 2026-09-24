import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  TOKEN_STATUS_REGISTRY, TOKEN_STATUS_CATEGORY_COLORS, findTokenStatus,
  MANUAL_TOGGLE_STATUS_CODES, PANEL_STATUSES, DECLARATION_BLOCKING_STATUS_CODES,
  DEFENSELESS_STATUS_CODES, COMBAT_END_CLEARED_STATUS_CODES, GM_ONLY_STATUS_CODES,
  canEditTokenStatus,
} from './tokenStatusRegistry.js'
import { ENVIRONMENTAL_HAZARD_REGISTRY } from './environmentalHazardRegistry.js'

// INSTANTANÉ (2026-09-24) — à l'origine, les littéraux qui existaient avant le registre, recopiés à la
// main depuis le code d'alors (le commit 1a ne devait changer AUCUN comportement : ce test le prouvait).
// Un nouveau statut modifie ces attentes VOLONTAIREMENT, dans le diff du commit qui l'ajoute — jamais en
// silence. Mis à jour par le commit qui ajoute `dead` (chantier 6ᵉ ligne du compteur de blessures, 1b).
const AVANT = {
  // socketToken.js — VALID_STATUS_CODES
  basculeManuelle: [
    'grappled', 'restrained', 'off_balance', 'asphyxia', 'electrocuted',
    'stunned', 'unconscious', 'blinded', 'hypothermia', 'infected', 'poisoned', 'irradiated',
    'dead',
  ],
  // TokenStatusPanel.jsx — STATUS_LIST (ordre = ordre d'affichage)
  panneau: [
    ['grappled', 'entrave'], ['restrained', 'entrave'], ['off_balance', 'entrave'],
    ['burning', 'dot'], ['acid', 'dot'], ['asphyxia', 'dot'], ['decompression', 'dot'], ['electrocuted', 'dot'],
    ['stunned', 'sens'], ['unconscious', 'sens'], ['blinded', 'sens'],
    ['hypothermia', 'chronique'], ['infected', 'chronique'], ['poisoned', 'chronique'], ['irradiated', 'chronique'],
    ['dead', 'mort'],
  ],
  // TokenPresentation.jsx — STATUS_CATEGORY (16 codes, dont evanoui)
  categories: {
    grappled: 'entrave', restrained: 'entrave', off_balance: 'entrave',
    burning: 'dot', acid: 'dot', asphyxia: 'dot', decompression: 'dot', electrocuted: 'dot',
    stunned: 'sens', unconscious: 'sens', blinded: 'sens', evanoui: 'sens',
    hypothermia: 'chronique', infected: 'chronique', poisoned: 'chronique', irradiated: 'chronique',
    dead: 'mort',
  },
  // TokenStatusPanel.jsx CATEGORY_COLOR et TokenPresentation.jsx STATUS_CATEGORY_COLOR (identiques)
  couleurs: { entrave: '#d8a838', dot: '#d84838', sens: '#9858c8', chronique: '#38a8c8', mort: '#8b8b9a' },
  // socketCombatResolution.js:165/353 (STUN2)
  bloqueDeclaration: ['stunned', 'unconscious', 'dead'],
  // socketCombatHelpers.js:996 (isTargetDefenseless, DEF5)
  sansDefense: ['unconscious', 'blinded', 'stunned', 'dead'],
  // socketCombatState.js:302/307 (nettoyage de fin de combat)
  nettoyeFinDeCombat: ['stunned', 'unconscious'], // `dead` n'y entre JAMAIS : seul le MJ le retire
  // Réservés au MJ quelle que soit l'option de campagne (1b) : dangers, froid, mort.
  reserveMJ: ['burning', 'acid', 'decompression', 'hypothermia', 'dead'],
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

test('réservés au MJ : dangers, froid et mort (ajout du drapeau gmOnly, 1b)', () => {
  assert.deepEqual(trie(GM_ONLY_STATUS_CODES), trie(AVANT.reserveMJ))
})

test('dead : bloque la déclaration, sans défense, jamais nettoyé en fin de combat, réservé MJ', () => {
  assert.ok(DECLARATION_BLOCKING_STATUS_CODES.includes('dead'))
  assert.ok(DEFENSELESS_STATUS_CODES.includes('dead'))
  assert.equal(COMBAT_END_CLEARED_STATUS_CODES.includes('dead'), false)
  assert.ok(GM_ONLY_STATUS_CODES.includes('dead'))
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

// Règle de droits unique (serveur : socketToken.js ; client : TokenStatusPanel.jsx).
test('canEditTokenStatus — le MJ peut tout ce qui est dans le registre', () => {
  for (const { code } of TOKEN_STATUS_REGISTRY) {
    assert.equal(canEditTokenStatus(code, { isGm: true, isOwner: false, playersEditStatuses: false }), true, code)
  }
})

test("canEditTokenStatus — propriétaire : statut ordinaire selon l'option, gmOnly jamais", () => {
  const owner = (playersEditStatuses) => ({ isGm: false, isOwner: true, playersEditStatuses })
  assert.equal(canEditTokenStatus('grappled', owner(true)), true)
  assert.equal(canEditTokenStatus('grappled', owner(false)), false)
  for (const code of AVANT.reserveMJ) {
    assert.equal(canEditTokenStatus(code, owner(true)), false, `${code} ne doit pas être éditable par un propriétaire`)
  }
})

test('canEditTokenStatus — ni MJ ni propriétaire : refus ; code inconnu : refus pour tous', () => {
  assert.equal(canEditTokenStatus('grappled', { isGm: false, isOwner: false, playersEditStatuses: true }), false)
  assert.equal(canEditTokenStatus('iem_survival', { isGm: true, isOwner: true, playersEditStatuses: true }), false)
  assert.equal(canEditTokenStatus(undefined, { isGm: true }), false)
  assert.equal(canEditTokenStatus('grappled'), false) // sans contexte : ni MJ ni propriétaire
})

// Garde-fou d'ajout de statut : un statut affiché au panneau ou qui bloque l'action DOIT avoir son icône
// et son libellé (sinon : image cassée / clé i18n brute dans le message « vous êtes … »).
test('chaque statut du panneau ou bloquant a son icône SVG et sa clé i18n status.<code>', () => {
  const racine = new URL('../', import.meta.url)
  const fr = JSON.parse(readFileSync(new URL('client/src/locales/fr.json', racine), 'utf8'))
  for (const entry of TOKEN_STATUS_REGISTRY.filter(s => s.inPanel || s.blocksDeclaration)) {
    assert.ok(existsSync(new URL(`client/public/assets/status/${entry.code}.svg`, racine)), `icône manquante : ${entry.code}`)
    assert.ok(typeof fr.status?.[entry.code] === 'string', `clé fr.json status.${entry.code} manquante`)
  }
})
