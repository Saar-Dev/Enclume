import test from 'node:test'
import assert from 'node:assert/strict'

import { buildInventorySuggestions, SUGGESTION_KIND, SUGGESTION_LIMIT } from './itemSuggestions.js'

// ── Fabriques ────────────────────────────────────────────────────────────────
const weapon = (id, caliber, over = {}) => ({
  id, ref_family: 'Armes', ref_category: "Arme d'épaule", ref_name: `Arme ${id}`, ref_caliber: caliber,
  ref_ammo_count: '30', container: 'Sac', slots: null, quantity: 1, ammo_remaining: null, ref_weight: 3, ...over,
})
const ammoItem = (id, caliber, over = {}) => ({
  id, ref_family: 'Munitions', ref_category: 'Balles', ref_name: `Munition ${id}`, ref_caliber: caliber,
  container: 'Sac', slots: null, quantity: 10, ref_weight: 0.1, ...over,
})
const bag = (id, capacity, over = {}) => ({
  id, ref_family: 'Equipement Général', ref_category: 'Contenants portables', ref_location: 'D', ref_capacity: capacity,
  ref_name: `Sac ${id}`, container: 'Coffre', slots: null, quantity: 1, ref_weight: 1, ...over,
})
const belt = (id, over = {}) => ({
  id, ref_family: 'Equipement Général', ref_category: 'Contenants portables', ref_location: 'Ce', ref_capacity: 3,
  ref_name: `Ceinture ${id}`, container: 'Coffre', slots: null, quantity: 1, ref_weight: 0.5, ...over,
})
const refAmmo = (id, caliber, name, price) => ({ id, family: 'Munitions', category: 'Balles', name, caliber, price })
const refBag = (id, capacity, price) => ({ id, family: 'Equipement Général', category: 'Contenants portables', name: `Sac ref ${id}`, location: 'D', capacity, price })
const refBelt = (id, price) => ({ id, family: 'Equipement Général', category: 'Contenants portables', name: `Ceinture ref ${id}`, location: 'Ce', capacity: 3, price })

const CATALOG = [
  refAmmo('a-hp', '5.56 mm', '5.56 mm - Munition HP', 16),
  refAmmo('a-std', '5.56 mm', '5.56 mm - Munition standard', 6),
  refAmmo('a-sap', '5.56 mm', '5.56 mm - Munition SAP', 9),
  refAmmo('a-apc', '5.56 mm', '5.56 mm - Munition APHC', 11),
  refAmmo('a-ce', 'Charge électrique', 'Charge électrique', 10),
  refBag('b-small', 8, 70), refBag('b-mid', 25, 160), refBag('b-big', 50, 840), refBag('b-cheap2', 10, 110),
  refBelt('c1', 90), refBelt('c2', 260),
]

// Inventaire « complet » (sac équipé + ceinture) pour isoler la règle testée.
const withContainers = (...items) => [bag('sac', 25, { slots: ['D'] }), belt('cei', { slots: ['Ce'] }), ...items]

// ── Munitions ────────────────────────────────────────────────────────────────
test('arme en main, chargeur vide, aucune réserve → priorité 1, standard en premier', () => {
  const inv = withContainers(weapon('w1', '5.56 mm', { slots: ['MD'], ammo_remaining: 0 }))
  const [s] = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(s.kind, SUGGESTION_KIND.AMMO)
  assert.equal(s.priority, 1)
  assert.equal(s.reasonKey, 'inventoryPanel.suggestions.ammoEmptyInHand')
  assert.deepEqual(s.reasonParams, { weapon: 'Arme w1', caliber: '5.56 mm' })
  assert.deepEqual(s.candidates.map(c => c.id), ['a-std', 'a-sap', 'a-apc'])
})

test('arme dans le sac sans aucune munition → priorité 2', () => {
  const inv = withContainers(weapon('w1', '5.56 mm'))
  const [s] = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(s.priority, 2)
  assert.equal(s.reasonKey, 'inventoryPanel.suggestions.ammoNone')
})

test('arme en main NON vide, sans réserve → priorité 2 (pas urgent)', () => {
  const inv = withContainers(weapon('w1', '5.56 mm', { slots: ['MD'], ammo_remaining: 12 }))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].priority, 2)
})

test('munitions du bon calibre dans le sac → aucune suggestion', () => {
  const inv = withContainers(weapon('w1', '5.56 mm', { slots: ['MD'], ammo_remaining: 0 }), ammoItem('m1', '5.56 mm'))
  assert.deepEqual(buildInventorySuggestions({ inventory: inv, catalog: CATALOG }), [])
})

test('munitions à la ceinture comptent comme réserve', () => {
  const inv = withContainers(weapon('w1', '5.56 mm'), ammoItem('m1', '5.56 mm', { container: 'Ceinture' }))
  assert.deepEqual(buildInventorySuggestions({ inventory: inv, catalog: CATALOG }), [])
})

test('munitions seulement au Coffre → information « à déplacer », sans candidat', () => {
  const inv = withContainers(weapon('w1', '5.56 mm'), ammoItem('m1', '5.56 mm', { container: 'Coffre' }))
  const [s] = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(s.kind, SUGGESTION_KIND.AMMO_IN_STASH)
  assert.equal(s.reasonKey, 'inventoryPanel.suggestions.ammoInStash')
  assert.deepEqual(s.candidates, [])
})

test('mauvais calibre dans le sac : ne compte pas comme réserve', () => {
  const inv = withContainers(weapon('w1', '5.56 mm'), ammoItem('m1', '9 mm'))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].kind, SUGGESTION_KIND.AMMO)
})

test('arme de contact à charges (Charge électrique) : même règle', () => {
  const matraque = weapon('w2', 'Charge électrique', { ref_category: 'Arme de contact', ref_name: 'Matraque Mao' })
  const [s] = buildInventorySuggestions({ inventory: withContainers(matraque), catalog: CATALOG })
  assert.deepEqual(s.candidates.map(c => c.id), ['a-ce'])
  assert.equal(s.reasonParams.weapon, 'Matraque Mao')
})

test('arme sans calibre (chalumeau, épée) : aucune suggestion', () => {
  const inv = withContainers(weapon('w3', null), weapon('w4', ''))
  assert.deepEqual(buildInventorySuggestions({ inventory: inv, catalog: CATALOG }), [])
})

test('calibre sans aucune munition au catalogue (Spécial) : aucune suggestion', () => {
  const inv = withContainers(weapon('w5', 'Spécial'))
  assert.deepEqual(buildInventorySuggestions({ inventory: inv, catalog: CATALOG }), [])
})

test('deux armes du même calibre : une seule suggestion qui nomme les deux', () => {
  const inv = withContainers(weapon('w1', '5.56 mm'), weapon('w6', '5.56 mm', { ref_name: 'AX 56' }))
  const list = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(list.length, 1)
  assert.equal(list[0].reasonParams.weapon, 'Arme w1, AX 56')
})

test('nom personnalisé prioritaire sur le nom du catalogue', () => {
  const inv = withContainers(weapon('w1', '5.56 mm', { custom_name: 'Ma vieille AX' }))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].reasonParams.weapon, 'Ma vieille AX')
})

test('munition de quantité 0 ne compte pas comme réserve', () => {
  const inv = withContainers(weapon('w1', '5.56 mm'), ammoItem('m1', '5.56 mm', { quantity: 0 }))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].kind, SUGGESTION_KIND.AMMO)
})

// ── Conteneurs ───────────────────────────────────────────────────────────────
test('aucun sac → sacs les moins chers, 3 candidats', () => {
  const inv = [belt('cei', { slots: ['Ce'] })]
  const [s] = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(s.reasonKey, 'inventoryPanel.suggestions.noBag')
  assert.equal(s.priority, 4)
  assert.deepEqual(s.candidates.map(c => c.id), ['b-small', 'b-cheap2', 'b-mid'])
})

test('sac possédé (même non équipé) : pas de suggestion « aucun sac »', () => {
  const inv = [bag('sac', 25), belt('cei')]
  assert.deepEqual(buildInventorySuggestions({ inventory: inv, catalog: CATALOG }), [])
})

test('une bouteille (emplacement D sans capacité) n’est pas un sac', () => {
  const bouteille = { ...bag('bout', null), ref_capacity: null }
  const inv = [bouteille, belt('cei')]
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].reasonKey, 'inventoryPanel.suggestions.noBag')
})

test('aucune ceinture → ceintures', () => {
  const inv = [bag('sac', 25, { slots: ['D'] })]
  const [s] = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(s.reasonKey, 'inventoryPanel.suggestions.noBelt')
  assert.equal(s.priority, 5)
  assert.deepEqual(s.candidates.map(c => c.id), ['c1', 'c2'])
})

test('sac équipé plein → sacs de capacité supérieure, croissante', () => {
  const lourd = { id: 'x1', ref_family: 'Equipement Général', ref_category: 'Outillage', ref_name: 'Caisse', container: 'Sac', slots: null, quantity: 3, ref_weight: 10 }
  const inv = withContainers(lourd)                        // 30 kg dans un sac de 25 kg
  const [s] = buildInventorySuggestions({ inventory: inv, catalog: CATALOG })
  assert.equal(s.reasonKey, 'inventoryPanel.suggestions.bagFull')
  assert.deepEqual(s.reasonParams, { load: 30, capacity: 25 })
  assert.deepEqual(s.candidates.map(c => c.id), ['b-big'])
})

test('sac plein : les objets équipés et ceux du Coffre ne comptent pas dans le contenu', () => {
  const enMain = weapon('w1', null, { container: 'Sac', slots: ['MD'], ref_weight: 40 })
  const auCoffre = { id: 'x2', ref_family: 'Equipement Général', ref_category: 'Outillage', ref_name: 'Caisse', container: 'Coffre', slots: null, quantity: 5, ref_weight: 20 }
  assert.deepEqual(buildInventorySuggestions({ inventory: withContainers(enMain, auCoffre), catalog: CATALOG }), [])
})

test('sac exactement plein : pas de suggestion', () => {
  const pile = { id: 'x3', ref_family: 'Equipement Général', ref_category: 'Outillage', ref_name: 'Caisse', container: 'Sac', slots: null, quantity: 1, ref_weight: 25 }
  assert.deepEqual(buildInventorySuggestions({ inventory: withContainers(pile), catalog: CATALOG }), [])
})

// ── Ordre, limite, robustesse ────────────────────────────────────────────────
test('ordre : munitions urgentes, munitions, sac plein, aucun sac, aucune ceinture', () => {
  const lourd = { id: 'x1', ref_family: 'Equipement Général', ref_category: 'Outillage', ref_name: 'Caisse', container: 'Sac', slots: null, quantity: 3, ref_weight: 10 }
  const inv = [
    bag('sac', 25, { slots: ['D'] }), lourd,
    weapon('w1', '5.56 mm', { slots: ['MD'], ammo_remaining: 0 }),
    weapon('w2', 'Charge électrique'),
  ]
  assert.deepEqual(
    buildInventorySuggestions({ inventory: inv, catalog: CATALOG }).map(s => s.reasonKey.split('.').pop()),
    ['ammoEmptyInHand', 'ammoNone', 'bagFull', 'noBelt'],
  )
})

test('limite : au plus SUGGESTION_LIMIT suggestions', () => {
  const calibers = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
  const catalog = [...CATALOG, ...calibers.map(c => refAmmo(`a-${c}`, c, `${c} std`, 5))]
  const inv = calibers.map((c, i) => weapon(`w${i}`, c))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog }).length, SUGGESTION_LIMIT)
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog, limit: 2 }).length, 2)
})

test('catalogue vide (pas encore chargé) ou entrées absentes : liste vide, sans erreur', () => {
  assert.deepEqual(buildInventorySuggestions({ inventory: [weapon('w1', '5.56 mm')], catalog: [] }), [])
  assert.deepEqual(buildInventorySuggestions(), [])
  assert.deepEqual(buildInventorySuggestions({}), [])
})

test('arme en main sans capacité de chargeur connue : jamais « vide » (weaponAmmoStatus = null)', () => {
  const inv = withContainers(weapon('w1', '5.56 mm', { slots: ['MD'], ammo_remaining: 0, ref_ammo_count: null }))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].priority, 2)
})

test('arme en main jamais chargée (ammo_remaining null) : comptée vide comme à la fiche', () => {
  const inv = withContainers(weapon('w1', '5.56 mm', { slots: ['MD'], ammo_remaining: null }))
  assert.equal(buildInventorySuggestions({ inventory: inv, catalog: CATALOG })[0].priority, 1)
})
