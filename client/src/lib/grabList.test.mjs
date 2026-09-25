import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGrabList, findSelectedGrabRow } from './grabList.js'

const grenade = (id, container, over = {}) => ({
  id, equipment_id: 'eq-frag', container, slots: null, quantity: 1,
  ref_name: 'Grenade à fragmentation', ref_category: 'Grenade', ref_location: 'M', custom_name: null, ...over,
})

test('buildGrabList — regroupe les exemplaires identiques d’un même conteneur, garde le premier id', () => {
  const rows = buildGrabList([grenade('g1', 'Sac'), grenade('g2', 'Sac'), grenade('g3', 'Sac')])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Grenade à fragmentation')
  assert.equal(rows[0].container, 'Sac')
  assert.equal(rows[0].count, 3)
  assert.equal(rows[0].itemId, 'g1')
})

test('buildGrabList — Ceinture et Sac restent deux lignes ; coût : Ceinture −3, Sac Action simple ; Ceinture d’abord', () => {
  const rows = buildGrabList([grenade('s1', 'Sac'), grenade('c1', 'Ceinture'), grenade('c2', 'Ceinture')])
  assert.deepEqual(rows.map(r => [r.container, r.count]), [['Ceinture', 2], ['Sac', 1]])
  assert.deepEqual(rows.map(r => [r.iniCost, r.occupiesAction]), [[-3, false], [0, true]])
})

test('buildGrabList — exclut le Coffre, les objets équipés (main, armure), non tenables, sans catalogue ; le bouclier, tenable, est proposé', () => {
  const rows = buildGrabList([
    grenade('coffre', 'Coffre'),
    grenade('main', 'Sac', { slots: ['MD'] }),
    grenade('armure', 'Sac', { slots: ['T'], ref_location: 'T', ref_category: 'Armure' }),
    grenade('nonTenable', 'Sac', { equipment_id: 'eq-armure', ref_location: 'T', ref_category: 'Armure' }),
    grenade('bouclier', 'Sac', { equipment_id: 'eq-bouclier', ref_category: 'Bouclier' }),
    { id: 'custom', equipment_id: null, container: 'Sac', slots: [], ref_location: null, ref_category: null, custom_name: 'Truc' },
    grenade('ok', 'Ceinture'),
  ])
  // Décision Saar 2026-09-25 : un bouclier (catalogué `M`) est un objet à une main comme un autre. Ceinture avant Sac.
  assert.deepEqual(rows.map(r => r.itemId), ['ok', 'bouclier'])
})

test('buildGrabList — un objet à deux mains (2M) est proposé ; slots vide ou null = rangé', () => {
  const rows = buildGrabList([
    { id: 'k1', equipment_id: 'eq-klauss', container: 'Sac', slots: [], quantity: 1, ref_name: 'Klauss', ref_category: 'Arme d’épaule', ref_location: '2M' },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Klauss')
})

test('buildGrabList — nom personnalisé prioritaire ; groupes distincts par équipement ; tri alphabétique dans un conteneur', () => {
  const rows = buildGrabList([
    grenade('a', 'Sac', { equipment_id: 'eq-b', ref_name: 'Grenade sonique' }),
    grenade('b', 'Sac', { equipment_id: 'eq-a', ref_name: 'Grenade à fragmentation', custom_name: 'Ananas' }),
  ])
  assert.deepEqual(rows.map(r => r.name), ['Ananas', 'Grenade sonique'])
})

test('buildGrabList — quantité > 1 sur une ligne (objet empilable) : comptée dans le groupe', () => {
  const rows = buildGrabList([grenade('a', 'Sac', { quantity: 3 }), grenade('b', 'Sac', { quantity: 2 })])
  assert.equal(rows[0].count, 5)
})

test('buildGrabList — entrée absente ou vide : liste vide, jamais une exception', () => {
  assert.deepEqual(buildGrabList(null), [])
  assert.deepEqual(buildGrabList(undefined), [])
  assert.deepEqual(buildGrabList([]), [])
})

test('findSelectedGrabRow — retrouve la ligne par l’id choisi ; objet parti ou absent : null', () => {
  const rows = buildGrabList([grenade('g1', 'Ceinture')])
  assert.equal(findSelectedGrabRow(rows, 'g1').container, 'Ceinture')
  assert.equal(findSelectedGrabRow(rows, 'disparu'), null)
  assert.equal(findSelectedGrabRow(rows, null), null)
})

// ─── Empreinte d'état (PLAN_PRISE_EN_MAIN.md, Lot B) : on ne regroupe que des exemplaires réellement identiques ─────────

const pistol = (id, container, over = {}) => ({
  id, equipment_id: 'eq-scorpion', container, slots: null, quantity: 1,
  ref_name: 'Scorpion', ref_category: 'Armes de poing', ref_location: 'M', ref_caliber: '9 mm', ref_ammo_count: '15',
  ammo_remaining: 15, current_ammo: null, custom_name: null, ...over,
})

test('buildGrabList — deux armes à chargeur identiques sur le papier : UNE LIGNE PAR EXEMPLAIRE (« prendre le premier » serait faux)', () => {
  const rows = buildGrabList([pistol('p1', 'Sac', { ammo_remaining: 15 }), pistol('p2', 'Sac', { ammo_remaining: 3 })])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(r => r.itemId).sort(), ['p1', 'p2'])
  assert.deepEqual(rows.map(r => r.count), [1, 1])
})

test('buildGrabList — même deux exemplaires au chargeur strictement égal : une ligne chacun (toute arme à calibre reste individuelle)', () => {
  const rows = buildGrabList([pistol('p1', 'Sac'), pistol('p2', 'Sac')])
  assert.equal(rows.length, 2)
})

test('buildGrabList — des grenades à état différent (nom personnalisé, usure, panne, lunette, type chargé) ne se regroupent pas', () => {
  const rows = buildGrabList([
    grenade('base1', 'Sac'), grenade('base2', 'Sac'),
    grenade('nom', 'Sac', { custom_name: 'Ananas' }),
    grenade('usee', 'Sac', { integrity_current: 2, integrity_max: 5 }),
    grenade('panne', 'Sac', { malfunction_severity: 'jam' }),
    grenade('lunette', 'Sac', { lunette_niveau: 2 }),
    grenade('propres', 'Sac', { custom_props: { note: 'x' } }),
  ])
  // Les deux exemplaires identiques restent groupés ; chacun des cinq états distincts a sa propre ligne.
  assert.equal(rows.length, 6)
  assert.equal(rows.find(r => r.itemId === 'base1').count, 2)
})

test('buildGrabList — la ligne d’un groupe identique porte le premier exemplaire, et le choix reste retrouvable par findSelectedGrabRow', () => {
  const rows = buildGrabList([grenade('g1', 'Ceinture'), grenade('g2', 'Ceinture')])
  assert.equal(rows.length, 1)
  assert.equal(findSelectedGrabRow(rows, 'g1').count, 2)
  assert.equal(findSelectedGrabRow(rows, 'g2'), null) // seul le premier exemplaire identifie la ligne
})

test('buildGrabList — chaque ligne a une clé unique (clé React) même avec plusieurs exemplaires d’une arme', () => {
  const rows = buildGrabList([pistol('p1', 'Sac'), pistol('p2', 'Sac'), pistol('p3', 'Ceinture'), grenade('g1', 'Sac')])
  assert.equal(new Set(rows.map(r => r.key)).size, rows.length)
})
