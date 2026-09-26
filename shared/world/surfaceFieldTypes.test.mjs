import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { MAP_LIMITS } from './mapLimits.js'
import { SURFACE_FIELD_TABLES, STRICT_TYPE_CODES, checkStrictTypes } from './surfaceFieldTypes.js'
import { baseRoom, checkerboardRoom, emptySurface, healthySurface, squareRoom } from './mapTestFixtures.mjs'

const codes = result => result.errors.map(error => error.code)
const paths = result => result.errors.map(error => error.params.path)
const withRoom = patch => emptySurface({ rooms: { r: baseRoom(patch) } })
const door = patch => ({
  type: 'door', axis: 'z', state: 'closed', x0: 40, x1: 40, z0: 8, z1: 12, y: 0, ...patch,
})

// ─── Contrat du module ───────────────────────────────────────────────────────────────────────────

test('le module n\'importe que mapLimits et guardErrors', () => {
  const source = readFileSync(new URL('./surfaceFieldTypes.js', import.meta.url), 'utf8')
  const imported = [...source.matchAll(/^import .* from '([^']+)'/gm)].map(match => match[1]).sort()
  assert.deepEqual(imported, ['./guardErrors.js', './mapLimits.js'])
})

test('les codes émis existent dans STRICT_TYPE_CODES et réciproquement', () => {
  const source = readFileSync(new URL('./surfaceFieldTypes.js', import.meta.url), 'utf8')
  const emitted = new Set([...source.matchAll(/\.add\('([a-z_]+)'/g)].map(match => match[1]))
  for (const code of emitted) assert.ok(STRICT_TYPE_CODES.includes(code), `${code} manque dans STRICT_TYPE_CODES`)
  for (const code of STRICT_TYPE_CODES) assert.ok(emitted.has(code), `${code} n'est jamais émis`)
})

test('dérive : chaque champ numérique contrôlé par le validateur de production figure dans la table', () => {
  const source = readFileSync(new URL('./surfaceDocument.js', import.meta.url), 'utf8')
  const declared = new Set(Object.values(SURFACE_FIELD_TABLES).flatMap(table => Object.keys(table)))
  const listed = [...source.matchAll(/validateFiniteFields\([^,]+,\s*\[([^\]]*)\]/g)]
    .flatMap(match => [...match[1].matchAll(/'([A-Za-z0-9]+)'/g)].map(field => field[1]))
  assert.ok(listed.length >= 20, 'le test doit avoir trouvé les listes de champs du validateur')
  for (const field of listed) assert.ok(declared.has(field), `${field} est validé comme nombre mais absent de la table des types`)
})

// ─── Cartes saines ───────────────────────────────────────────────────────────────────────────────

test('une carte saine, des salles pleines et en damier passent', () => {
  assert.equal(checkStrictTypes(healthySurface()).ok, true)
  assert.equal(checkStrictTypes(emptySurface({ rooms: { a: squareRoom(30), b: checkerboardRoom(12) } })).ok, true)
  assert.equal(checkStrictTypes(emptySurface()).ok, true)
})

test('un champ absent, null ou inconnu est toléré', () => {
  assert.equal(checkStrictTypes(withRoom({ movementMultiplier: null, floorMaterial: null, boundaryArcs: null })).ok, true)
  assert.equal(checkStrictTypes(withRoom({ champInventeParUnTiers: { x: 'nimporte quoi' } })).ok, true)
  assert.equal(checkStrictTypes(emptySurface({ metersPerCell: undefined })).ok, true)
})

test('les références de texture acceptent un nombre, une chaîne ou null, pas autre chose', () => {
  for (const value of [3, 'a', null]) assert.equal(checkStrictTypes(withRoom({ floorTex: value })).ok, true, String(value))
  for (const value of [true, {}, []]) {
    assert.deepEqual(codes(checkStrictTypes(withRoom({ floorTex: value }))), ['wrong_type'], JSON.stringify(value))
  }
})

// ─── Mauvais types : ce que le validateur de production laisse passer ────────────────────────────

test('salle : bornes et champs numériques doivent être de vrais nombres', () => {
  for (const bad of ['0', '0x10', true, {}, [], Number.NaN]) {
    const result = checkStrictTypes(withRoom({ minX: bad }))
    assert.deepEqual(codes(result), ['wrong_type'], JSON.stringify(bad))
    assert.deepEqual(paths(result), ['$.rooms.r.minX'])
  }
  // Une borne null est refusée (le validateur de production la lit comme 0), une borne absente aussi.
  assert.deepEqual(codes(checkStrictTypes(withRoom({ maxZ: null }))), ['wrong_type'])
  const missing = baseRoom()
  delete missing.maxX
  const result = checkStrictTypes(emptySurface({ rooms: { r: missing } }))
  assert.equal(result.errors[0].params.actual, 'missing')
})

test('salle : champs non validés en production, désormais typés (épaisseurs, niveaux, booléens, textes)', () => {
  for (const patch of [{ heightLevels: '2' }, { floorThickness: '0.25' }, { level: false }, { y: 'haut' }]) {
    assert.deepEqual(codes(checkStrictTypes(withRoom(patch))), ['wrong_type'], JSON.stringify(patch))
  }
  for (const patch of [{ wallEnabled: 'true' }, { blocksSight: 1 }, { label: 12 }, { barrierType: {} }, { cells: 'x' }]) {
    assert.deepEqual(codes(checkStrictTypes(withRoom(patch))), ['wrong_type'], JSON.stringify(patch))
  }
})

test('salle : matériaux, arrondis, profils et chemins de murs', () => {
  const material = value => withRoom({ floorMaterial: { wear: value } })
  assert.deepEqual(paths(checkStrictTypes(material('5'))), ['$.rooms.r.floorMaterial.wear'])
  assert.equal(checkStrictTypes(material(5)).ok, true)

  const arc = patch => withRoom({ boundaryArcs: [{ id: 'a', edgeKeys: ['k1', 'k2'], start: { x: 0, z: 0 }, end: { x: 1, z: 1 }, angleDegrees: 90, side: 1, ...patch }] })
  assert.equal(checkStrictTypes(arc({})).ok, true)
  assert.deepEqual(paths(checkStrictTypes(arc({ angleDegrees: '90' }))), ['$.rooms.r.boundaryArcs[0].angleDegrees'])
  assert.deepEqual(paths(checkStrictTypes(arc({ start: { x: '0', z: 0 } }))), ['$.rooms.r.boundaryArcs[0].start.x'])

  const profile = value => withRoom({ wallElevationProfiles: [{ edgeKeys: ['k'], profile: { type: 'curved', depth: value, direction: 1 } }] })
  assert.deepEqual(paths(checkStrictTypes(profile('2'))), ['$.rooms.r.wallElevationProfiles[0].profile.depth'])

  const wallPath = patch => withRoom({ verticalProfile: { slices: [{ offset: 0, footprint: [], wallPaths: [{ axis: 'x', x0: 0, z0: 0, x1: 1, z1: 0, ...patch }] }] } })
  assert.equal(checkStrictTypes(wallPath({})).ok, true)
  assert.deepEqual(paths(checkStrictTypes(wallPath({ x0: null }))), ['$.rooms.r.verticalProfile.slices[0].wallPaths[0].x0'])
  // Un arc exige en plus centre, rayon et angles.
  assert.ok(codes(checkStrictTypes(wallPath({ axis: 'arc' }))).length >= 5)
})

test('connecteurs : porte, porte sur courbe, ascenseur', () => {
  const surface = connector => emptySurface({ connectors: { c: connector } })
  assert.equal(checkStrictTypes(surface(door({}))).ok, true)
  assert.deepEqual(paths(checkStrictTypes(surface(door({ x0: '40' })))), ['$.connectors.c.x0'])
  assert.deepEqual(paths(checkStrictTypes(surface(door({ y: null })))), ['$.connectors.c.y'])
  assert.deepEqual(codes(checkStrictTypes(surface(door({ state: 5 })))), ['wrong_type'])
  assert.deepEqual(codes(checkStrictTypes(surface(door({ modelGeometry: [] })))), ['wrong_type'])
  assert.deepEqual(codes(checkStrictTypes(surface(door({ roomIds: 'a' })))), ['wrong_type'])
  // Porte sur courbe : les ancrages sont obligatoires.
  assert.ok(codes(checkStrictTypes(surface(door({ axis: 'segment' })))).length >= 8)
  // Ascenseur : arrêts et niveaux obligatoires.
  assert.equal(checkStrictTypes(surface({ type: 'elevator', x: 1, z: 2, fromLevel: 0, toLevel: 3 })).ok, true)
  assert.deepEqual(paths(checkStrictTypes(surface({ type: 'elevator', x: 1, z: 2, fromLevel: 0 }))), ['$.connectors.c.toLevel'])
})

test('collections historiques : coordonnées seulement si présentes, obligatoires pour murs et escaliers', () => {
  assert.equal(checkStrictTypes(emptySurface({ floors: { '1:2:0': {} }, ceilings: { '1:2:0:2.5': {} } })).ok, true)
  assert.deepEqual(paths(checkStrictTypes(emptySurface({ floors: { '1:2:0': { x: '1' } } }))), ['$.floors.1:2:0.x'])
  assert.equal(checkStrictTypes(emptySurface({ walls: { w: { axis: 'x', x0: 0, x1: 1, z0: 0, z1: 0 } } })).ok, true)
  assert.equal(checkStrictTypes(emptySurface({ walls: { w: { axis: 'x', x0: 0, x1: 1, z0: 0 } } })).ok, false)
  assert.equal(checkStrictTypes(emptySurface({ stairs: { s: { axis: 'x' } } })).ok, false)
})

test('niveau supérieur : version, fine, storyHeight', () => {
  assert.deepEqual(paths(checkStrictTypes(emptySurface({ version: '12' }))), ['$.version'])
  assert.deepEqual(paths(checkStrictTypes(emptySurface({ storyHeight: true }))), ['$.storyHeight'])
  assert.equal(checkStrictTypes(emptySurface({ fine: null })).ok, true)
})

// ─── Robustesse ──────────────────────────────────────────────────────────────────────────────────

test('des entrées malformées sont ignorées sans exception (le validateur les signalera)', () => {
  const result = checkStrictTypes(emptySurface({
    rooms: { a: baseRoom({ boundaryArcs: [1, null, 'x', [], {}], wallElevationProfiles: [null], verticalProfile: { slices: [null, 3, { wallPaths: [null, 'x'] }] } }), b: 'x', c: null },
    connectors: { d: null, e: 'x' },
  }))
  assert.equal(result.ok, true)
  for (const value of [null, [], 'x', 3]) assert.deepEqual(codes(checkStrictTypes(value)), ['not_object'])
})

test('les erreurs sont plafonnées et le drapeau truncated est levé', () => {
  const rooms = {}
  for (let index = 0; index < 10; index += 1) rooms[`r${index}`] = baseRoom({ y: 'x' })
  const result = checkStrictTypes(emptySurface({ rooms }), { ...MAP_LIMITS, maxErrors: 3 })
  assert.equal(result.errors.length, 3)
  assert.equal(result.truncated, true)
})

test('les erreurs portent un chemin, le type attendu et le type reçu, sans texte français', () => {
  const [error] = checkStrictTypes(withRoom({ heightLevels: '2' })).errors
  assert.deepEqual(error.params, { path: '$.rooms.r.heightLevels', expected: 'number', actual: 'string' })
  assert.equal(Object.isFrozen(error), true)
})
