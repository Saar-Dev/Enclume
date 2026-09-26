import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { MAP_LIMITS } from './mapLimits.js'
import {
  IMPORT_GUARD_CODES,
  IMPORT_GUARD_COLLECTION_LIMITS,
  checkSurfaceLimits,
  scanJsonStructure,
} from './importGuard.js'
import { SURFACE_COLLECTIONS, validateSurfaceData } from './surfaceDocument.js'
import {
  baseRoom,
  checkerboardRoom,
  emptySurface,
  healthySurface,
  nestedArrays,
  rectangleRoom,
  squareRoom,
  wideArray,
} from './mapTestFixtures.mjs'

const codes = result => result.errors.map(error => error.code)

// ─── Contrat du module ───────────────────────────────────────────────────────────────────────────

test('la carte saine des fixtures est réaliste : le validateur de production l\'accepte', () => {
  assert.equal(validateSurfaceData(healthySurface()).valid, true)
})

test('toutes les collections de surface_data ont un plafond, et aucune n\'est inventée', () => {
  assert.deepEqual(Object.keys(IMPORT_GUARD_COLLECTION_LIMITS).sort(), [...SURFACE_COLLECTIONS].sort())
  for (const limitName of Object.values(IMPORT_GUARD_COLLECTION_LIMITS)) {
    assert.ok(limitName in MAP_LIMITS, `${limitName} doit exister dans MAP_LIMITS`)
  }
})

test('le module n\'importe que mapLimits et roomGeometry (aucune autre dépendance)', () => {
  const source = readFileSync(new URL('./importGuard.js', import.meta.url), 'utf8')
  const imported = [...source.matchAll(/^import .* from '([^']+)'/gm)].map(match => match[1]).sort()
  assert.deepEqual(imported, ['./guardErrors.js', './mapLimits.js', './roomGeometry.js'])
})

test('chaque code d\'erreur émis existe dans IMPORT_GUARD_CODES', () => {
  const source = readFileSync(new URL('./importGuard.js', import.meta.url), 'utf8')
  const emitted = new Set([...source.matchAll(/\.add\('([a-z_]+)'/g)].map(match => match[1]))
  for (const code of emitted) assert.ok(IMPORT_GUARD_CODES.includes(code), `${code} manque dans IMPORT_GUARD_CODES`)
  for (const code of IMPORT_GUARD_CODES) assert.ok(emitted.has(code), `${code} n'est jamais émis`)
})

// ─── scanJsonStructure ───────────────────────────────────────────────────────────────────────────

test('scan : une carte saine passe', () => {
  const result = scanJsonStructure(JSON.parse(JSON.stringify(healthySurface())))
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.truncated, false)
})

test('scan : profondeur maximale acceptée, une de plus refusée', () => {
  assert.equal(scanJsonStructure(nestedArrays(MAP_LIMITS.maxJsonDepth)).ok, true)
  const tooDeep = scanJsonStructure(nestedArrays(MAP_LIMITS.maxJsonDepth + 1))
  assert.deepEqual(codes(tooDeep), ['json_too_deep'])
})

test('scan : 100 000 niveaux d\'imbrication sont refusés sans dépasser la pile', () => {
  const result = scanJsonStructure(nestedArrays(100000))
  assert.deepEqual(codes(result), ['json_too_deep'])
})

test('scan : trop de nœuds, y compris avec le plafond réel', () => {
  const small = scanJsonStructure(wideArray(51), { ...MAP_LIMITS, maxJsonNodes: 50 })
  assert.deepEqual(codes(small), ['json_too_many_nodes'])
  const real = scanJsonStructure(wideArray(MAP_LIMITS.maxJsonNodes + 1))
  assert.deepEqual(codes(real), ['json_too_many_nodes'])
})

test('scan : un tableau annoncé énorme est refusé avant d\'être empilé', () => {
  const result = scanJsonStructure({ a: wideArray(MAP_LIMITS.maxJsonNodes * 3) })
  assert.deepEqual(codes(result), ['json_too_many_nodes'])
})

test('scan : chaîne et clé trop longues', () => {
  const longString = scanJsonStructure({ name: 'x'.repeat(MAP_LIMITS.maxStringLength + 1) })
  assert.deepEqual(codes(longString), ['string_too_long'])
  assert.equal(longString.errors[0].params.path, '$.name')
  const longKey = scanJsonStructure({ ['k'.repeat(MAP_LIMITS.maxKeyLength + 1)]: 1 })
  assert.deepEqual(codes(longKey), ['key_too_long'])
})

test('scan : clés dangereuses refusées à tous les niveaux (obtenues par JSON.parse, où __proto__ est une clé propre)', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const parsed = JSON.parse(`{"rooms":{"a":{"${key}":{"x":1}}}}`)
    const result = scanJsonStructure(parsed)
    assert.deepEqual(codes(result), ['forbidden_key'], key)
    assert.equal(result.errors[0].params.key, key)
  }
})

test('scan : NUL et caractères de contrôle refusés, tabulation et saut de ligne admis', () => {
  assert.deepEqual(codes(scanJsonStructure({ label: 'a\u0000b' })), ['control_character'])
  assert.deepEqual(codes(scanJsonStructure({ label: 'a\u001fb' })), ['control_character'])
  assert.deepEqual(codes(scanJsonStructure({ label: 'a\u007fb' })), ['control_character'])
  assert.deepEqual(codes(scanJsonStructure({ ['a\u0000b']: 1 })), ['control_character'])
  assert.equal(scanJsonStructure({ label: 'ligne 1\nligne 2\tfin' }).ok, true)
})

test('scan : les nombres non finis (1e999 lu par JSON.parse) sont refusés', () => {
  const parsed = JSON.parse('{"rooms":{"a":{"minX":1e999}}}')
  const result = scanJsonStructure(parsed)
  assert.deepEqual(codes(result), ['non_finite_number'])
  assert.equal(result.errors[0].params.path, '$.rooms.a.minX')
  assert.deepEqual(codes(scanJsonStructure([Number.NaN])), ['non_finite_number'])
})

test('scan : les types qui ne viennent pas de JSON sont refusés', () => {
  for (const value of [() => 1, Symbol('s'), undefined, new Date(0), new Map(), 10n]) {
    assert.deepEqual(codes(scanJsonStructure({ a: value })), ['unsupported_type'])
  }
})

test('scan : les erreurs sont plafonnées et le drapeau truncated le dit', () => {
  const parsed = JSON.parse(`[${'1e999,'.repeat(99)}1e999]`)
  const result = scanJsonStructure(parsed)
  assert.equal(result.errors.length, MAP_LIMITS.maxErrors)
  assert.equal(result.truncated, true)
  assert.equal(result.ok, false)
})

test('scan : les erreurs sont figées et ne portent aucun texte français', () => {
  const result = scanJsonStructure({ a: 'x'.repeat(MAP_LIMITS.maxStringLength + 1) })
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.errors[0]), true)
  assert.match(result.errors[0].code, /^[a-z_]+$/)
})

// ─── checkSurfaceLimits ──────────────────────────────────────────────────────────────────────────

test('limites : une carte saine passe', () => {
  const result = checkSurfaceLimits(healthySurface())
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('limites : la surface est bornée (30×30 = 900 cases), pas la forme : couloir long accepté', () => {
  assert.equal(checkSurfaceLimits(emptySurface({ rooms: { r: squareRoom(30) } })).ok, true)
  // 31×31 = 961 cases > 900 : refusé, une seule fois (plafond de la salle, sans doubler par le total de la carte).
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: squareRoom(31) } }))), ['too_many_cells'])
  // Un couloir 60×10 (600 cases) et une salle 31×13 (celle de la carte réelle actuelle) sont légers : acceptés.
  assert.equal(checkSurfaceLimits(emptySurface({ rooms: { r: rectangleRoom(60, 10) } })).ok, true)
  assert.equal(checkSurfaceLimits(emptySurface({ rooms: { r: rectangleRoom(31, 13, { originX: -24, originZ: -6 }) } })).ok, true)
})

test('limites : le garde-fou par axe refuse une étendue absurde', () => {
  const tooWide = baseRoom({ minX: 0, maxX: MAP_LIMITS.maxExtentCells, minZ: 0, maxZ: 0 })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: tooWide } }))), ['room_extent_exceeded'])
})

test('limites : un document qui n\'est pas un objet est refusé', () => {
  for (const value of [null, [], 'x', 3]) assert.deepEqual(codes(checkSurfaceLimits(value)), ['not_object'])
})

test('limites : trop de salles, sans parcourir les salles', () => {
  const rooms = {}
  for (let index = 0; index <= MAP_LIMITS.maxRooms; index += 1) rooms[`r${index}`] = baseRoom()
  const result = checkSurfaceLimits(emptySurface({ rooms }))
  assert.deepEqual(codes(result), ['too_many_items'])
  assert.equal(result.errors[0].params.collection, 'rooms')
})

test('limites : trop d\'éléments dans chacune des autres collections', () => {
  const overflow = limit => Object.fromEntries(Array.from({ length: limit + 1 }, (_, index) => [`k${index}`, {}]))
  for (const [collection, limitName] of Object.entries(IMPORT_GUARD_COLLECTION_LIMITS)) {
    if (collection === 'rooms') continue
    const result = checkSurfaceLimits(emptySurface({ [collection]: overflow(MAP_LIMITS[limitName]) }))
    assert.deepEqual(codes(result), ['too_many_items'], collection)
    assert.equal(result.errors[0].params.collection, collection)
  }
})

test('limites : des bornes énormes sans cases ne sont jamais énumérées', () => {
  const room = baseRoom({ minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 })
  const result = checkSurfaceLimits(emptySurface({ rooms: { r: room } }))
  assert.ok(codes(result).includes('room_extent_exceeded'))
  assert.ok(codes(result).includes('room_coordinate_out_of_range'))
  // Bornes à 1e300 : l'aire dépasserait Infinity ; le total de cases n'est pas gonflé.
  const huge = baseRoom({ minX: -1e300, maxX: 1e300, minZ: -1e300, maxZ: 1e300 })
  assert.ok(!codes(checkSurfaceLimits(emptySurface({ rooms: { r: huge } }))).includes('too_many_total_cells'))
})

test('limites : des bornes qui ne sont pas des nombres finis de type number sont refusées', () => {
  for (const bad of ['0', null, Number.NaN, Infinity, true, undefined]) {
    const result = checkSurfaceLimits(emptySurface({ rooms: { r: baseRoom({ maxX: bad }) } }))
    assert.deepEqual(codes(result), ['room_bounds_invalid'], String(bad))
    assert.equal(result.errors[0].params.field, 'maxX')
  }
  assert.ok(codes(checkSurfaceLimits(emptySurface({ rooms: { r: { level: 0 } } }))).includes('room_bounds_invalid'))
})

test('limites : coordonnée trop éloignée de l\'origine', () => {
  const room = rectangleRoom(10, 10, { originX: MAP_LIMITS.maxAbsCoordinate - 5 })
  assert.ok(codes(checkSurfaceLimits(emptySurface({ rooms: { r: room } }))).includes('room_coordinate_out_of_range'))
  const inside = rectangleRoom(10, 10, { originX: MAP_LIMITS.maxAbsCoordinate - 10 })
  assert.equal(checkSurfaceLimits(emptySurface({ rooms: { r: inside } })).ok, true)
})

test('limites : trop de cases dans une salle, et sur l\'ensemble de la carte', () => {
  const oversizedCells = baseRoom({ minX: 0, maxX: 29, minZ: 0, maxZ: 29, cells: wideArray(MAP_LIMITS.maxTotalCells + 1, '0:0') })
  assert.ok(codes(checkSurfaceLimits(emptySurface({ rooms: { r: oversizedCells } }))).includes('too_many_cells'))

  const two = emptySurface({ rooms: { a: rectangleRoom(21, 21), b: rectangleRoom(21, 21, { originX: 40 }) } })
  assert.equal(checkSurfaceLimits(two).ok, true) // 882 cases
  const three = emptySurface({
    rooms: { a: rectangleRoom(21, 21), b: rectangleRoom(21, 21, { originX: 40 }), c: rectangleRoom(21, 21, { originX: 80 }) },
  })
  assert.deepEqual(codes(checkSurfaceLimits(three)), ['too_many_total_cells'])
})

test('limites : le contour trop complexe est refusé (damier), même dans le plafond de cases', () => {
  // 12×12 = 72 cases isolées = 288 arêtes de contour, dans le plafond de 300.
  assert.equal(checkSurfaceLimits(emptySurface({ rooms: { r: checkerboardRoom(12) } })).ok, true)
  // 20×20 = 200 cases (largement sous 900) mais 800 arêtes : refusé.
  const result = checkSurfaceLimits(emptySurface({ rooms: { r: checkerboardRoom(20) } }))
  assert.deepEqual(codes(result), ['room_boundary_too_complex'])
  assert.equal(result.errors[0].params.actual, 800)
  // Le pire cas de la carte (damier 30×30) est refusé lui aussi, sans compilation ni énumération de bornes.
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: checkerboardRoom(30) } }))), ['room_boundary_too_complex'])
})

test('limites : le budget de complexité de la carte entière s\'additionne d\'une salle à l\'autre', () => {
  const shift = (room, dx) => ({
    ...room,
    minX: room.minX + dx,
    maxX: room.maxX + dx,
    cells: room.cells.map(key => { const [x, z] = key.split(':').map(Number); return `${x + dx}:${z}` }),
  })
  // Un damier 12×12 = 288 arêtes → 82 944 : dans le budget de 150 000.
  const one = emptySurface({ rooms: { a: checkerboardRoom(12) } })
  assert.equal(checkSurfaceLimits(one).ok, true)
  // Deux damiers = 165 888 : chaque salle est sous son plafond (300), mais la carte dépasse le budget.
  const two = emptySurface({ rooms: { a: checkerboardRoom(12), b: shift(checkerboardRoom(12), 20) } })
  const result = checkSurfaceLimits(two)
  assert.deepEqual(codes(result), ['boundary_complexity_exceeded'])
  assert.equal(result.errors[0].params.actual, 165888)
  // La carte saine des fixtures consomme une fraction infime du budget.
  assert.equal(checkSurfaceLimits(healthySurface()).ok, true)
})

test('limites : une salle déjà refusée pour son contour ne compte pas deux fois dans le budget', () => {
  const result = checkSurfaceLimits(emptySurface({ rooms: { r: checkerboardRoom(20) } }))
  assert.deepEqual(codes(result), ['room_boundary_too_complex'])
})

test('limites : arrondis, profils, découpes et murs ouverts par salle', () => {
  const withArcs = baseRoom({ boundaryArcs: wideArray(MAP_LIMITS.maxArcsPerRoom + 1, {}) })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: withArcs } }))), ['too_many_arcs'])

  const half = Math.floor(MAP_LIMITS.maxProfilesPerRoom / 2)
  const withProfiles = baseRoom({ wallElevationProfiles: wideArray(half + 1, {}), wallAppearanceProfiles: wideArray(half + 1, {}) })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: withProfiles } }))), ['too_many_profiles'])

  const withClips = baseRoom({ geometryClipRoomIds: wideArray(MAP_LIMITS.maxClipRoomsPerRoom + 1, 'x') })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: withClips } }))), ['too_many_clip_rooms'])

  const withOpenWalls = baseRoom({ openWallEdgeKeys: wideArray(MAP_LIMITS.maxBoundaryEdgesPerRoom + 1, 'k') })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: withOpenWalls } }))), ['too_many_open_walls'])
})

test('limites : tranches verticales, points de contour et chemins de murs', () => {
  const slice = { offset: 0, footprint: [[[[0, 0]]]], wallPaths: [] }
  const tooManySlices = baseRoom({ verticalProfile: { slices: wideArray(MAP_LIMITS.maxVerticalSlices + 1, slice) } })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: tooManySlices } }))), ['too_many_slices'])

  const points = baseRoom({ verticalProfile: { slices: [{ offset: 0, footprint: [[wideArray(MAP_LIMITS.maxRingPoints + 1, [0, 0])]], wallPaths: [] }] } })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: points } }))), ['slice_too_many_points'])

  const walls = baseRoom({ verticalProfile: { slices: [{ offset: 0, footprint: [], wallPaths: wideArray(MAP_LIMITS.maxWalls + 1, {}) }] } })
  assert.deepEqual(codes(checkSurfaceLimits(emptySurface({ rooms: { r: walls } }))), ['slice_too_many_walls'])
})

test('limites : les erreurs sont plafonnées, le drapeau truncated est levé', () => {
  const rooms = {}
  for (let index = 0; index < 10; index += 1) rooms[`r${index}`] = baseRoom({ maxX: 'x' })
  const result = checkSurfaceLimits(emptySurface({ rooms }), { ...MAP_LIMITS, maxErrors: 3 })
  assert.equal(result.errors.length, 3)
  assert.equal(result.truncated, true)
})

test('limites : une collection ou une salle qui n\'est pas un objet est ignorée sans exception', () => {
  const result = checkSurfaceLimits({ rooms: [], floors: 'x', walls: null, connectors: { a: 1 } })
  assert.equal(result.ok, true)
  assert.equal(checkSurfaceLimits({ rooms: { a: 'x', b: null, c: [] } }).ok, true)
})

test('limites : des plafonds personnalisés sont respectés (les valeurs viennent de MAP_LIMITS, pas du code)', () => {
  const strict = { ...MAP_LIMITS, maxExtentCells: 5, maxTotalCells: 25 }
  assert.equal(checkSurfaceLimits(emptySurface({ rooms: { r: squareRoom(5) } }), strict).ok, true)
  assert.ok(codes(checkSurfaceLimits(emptySurface({ rooms: { r: squareRoom(6) } }), strict)).includes('room_extent_exceeded'))
})
