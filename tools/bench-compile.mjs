// tools/bench-compile.mjs
// Banc d'essai MANUEL (hors `npm test`) du coût d'un document de carte : validation, compilation du monde et taille JSON
// pour une salle décrite par ses cases, comme l'éditeur la produit. Sert à régler `MAP_LIMITS`
// (shared/world/mapLimits.js) par la mesure — docs/PLANS/PLAN_EXPORT_CARTE.md §6 et §12.
//
// Usage (depuis la racine) :
//   node tools/bench-compile.mjs                          # salles pleines de 10, 20, 30, 40, 50 cases de côté
//   node tools/bench-compile.mjs --sizes=10,25,40         # tailles choisies
//   node tools/bench-compile.mjs --shape=checkerboard     # salles en damier (cases isolées) : pire cas de contour
//   node tools/bench-compile.mjs --shape=checkerboard --sizes=12 --arcs=16
//                                                         # mesure la seule VALIDATION avec 16 arrondis déclarés
//   node tools/bench-compile.mjs --sizes=80 --force       # au-delà de la taille sûre : le serveur de dev gèlerait
//
// Aucune base, aucun serveur, aucune écriture : calcul en mémoire uniquement.

import { compileSurfaceWorld } from '../shared/world/worldCompiler.js'
import { prepareSurfaceData, validateSurfaceData } from '../shared/world/surfaceDocument.js'
import { roomBoundaryEdges } from '../shared/world/roomGeometry.js'
import { MAP_LIMITS } from '../shared/world/mapLimits.js'
import { checkerboardRoom, squareRoom } from '../shared/world/mapTestFixtures.mjs'

const DEFAULT_SIZES = [10, 20, 30, 40, 50]
// Au-delà, la compilation dure trop longtemps pour un essai courant (mesuré : plein 50×50 ≈ 14 s ; damier 16×16 ≈ 5 s,
// damier 30×30 > 2 minutes).
const SAFE_MAX_SIZE = { square: 60, checkerboard: 16 }

function optionValue(argv, name) {
  const found = argv.find(arg => arg.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

function parseArgs(argv) {
  const force = argv.includes('--force')
  const shape = optionValue(argv, 'shape') ?? 'square'
  if (!(shape in SAFE_MAX_SIZE)) throw new Error('--shape doit valoir square ou checkerboard')
  const sizesArg = optionValue(argv, 'sizes')
  const sizes = sizesArg ? sizesArg.split(',').map(value => Number(value.trim())) : DEFAULT_SIZES
  if (sizes.length === 0 || sizes.some(size => !Number.isInteger(size) || size < 1)) {
    throw new Error('--sizes doit être une liste d\'entiers strictement positifs, ex. --sizes=10,20,30')
  }
  const arcsArg = optionValue(argv, 'arcs')
  const arcs = arcsArg == null ? 0 : Number(arcsArg)
  if (!Number.isInteger(arcs) || arcs < 0) throw new Error('--arcs doit être un entier positif ou nul')
  const tooBig = sizes.filter(size => size > SAFE_MAX_SIZE[shape])
  if (tooBig.length > 0 && !force && arcs === 0) {
    throw new Error(`Taille(s) ${tooBig.join(', ')} > ${SAFE_MAX_SIZE[shape]} (forme ${shape}) : la compilation est synchrone et durerait très longtemps. Ajouter --force pour continuer.`)
  }
  return { sizes, shape, arcs }
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6
}

function formatMs(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(0)} ms`
}

// Arrondis déclarés dont les clés désignent de vraies arêtes du contour : le validateur recalcule alors tout le contour
// de la salle pour chacun (`selectedRoomBoundaryChain`), sans que le document soit pour autant valide.
function withDeclaredArcs(room, count) {
  const edges = roomBoundaryEdges(room)
  const arcs = Array.from({ length: count }, (_, index) => ({
    id: `arc-${index}`,
    edgeKeys: [edges[0].key, edges[1].key],
    start: { x: 0, z: 0 },
    end: { x: 1, z: 1 },
    angleDegrees: 90,
    side: 1,
  }))
  return { ...room, boundaryArcs: arcs }
}

function withinLimits(room) {
  const cells = room.cells.length
  const edges = roomBoundaryEdges(room).length
  const ok = cells <= MAP_LIMITS.maxTotalCells && edges <= MAP_LIMITS.maxBoundaryEdgesPerRoom
  return ok ? 'oui' : 'NON'
}

const { sizes, shape, arcs } = parseArgs(process.argv.slice(2))
const battlemapId = 'bench-compile'
const build = shape === 'checkerboard' ? checkerboardRoom : squareRoom

console.log(`Plafonds actuels : ${MAP_LIMITS.maxTotalCells} cases au total, ${MAP_LIMITS.maxBoundaryEdgesPerRoom} arêtes de contour par salle, ${MAP_LIMITS.maxArcsPerRoom} arrondis par salle.`)
console.log(`Forme : ${shape}${arcs > 0 ? `, ${arcs} arrondi(s) déclaré(s) (validation seule)` : ''}\n`)
console.log('taille   | cases | arêtes | validation | compilation | JSON (octets) | dans les plafonds')
console.log('---------|-------|--------|------------|-------------|---------------|------------------')

for (const size of sizes) {
  let room = build(size)
  const edgeCount = roomBoundaryEdges(room).length
  const inLimits = withinLimits(room)

  if (arcs > 0) {
    room = withDeclaredArcs(room, arcs)
    const start = process.hrtime.bigint()
    validateSurfaceData({ version: 12, rooms: { main: room } })
    const validateMs = elapsedMs(start)
    console.log([
      `${size}×${size}`.padEnd(8),
      String(room.cells.length).padStart(5),
      String(edgeCount).padStart(6),
      formatMs(validateMs).padStart(10),
      '-'.padStart(11),
      '-'.padStart(13),
      inLimits,
    ].join(' | '))
    continue
  }

  const prepareStart = process.hrtime.bigint()
  const prepared = prepareSurfaceData({ rooms: { main: room } }, { battlemapId }).surfaceData
  const prepareMs = elapsedMs(prepareStart)

  const compileStart = process.hrtime.bigint()
  compileSurfaceWorld({ battlemapId, worldRevision: 1, surfaceData: prepared })
  const compileMs = elapsedMs(compileStart)

  const jsonBytes = Buffer.byteLength(JSON.stringify(prepared))
  console.log([
    `${size}×${size}`.padEnd(8),
    String(room.cells.length).padStart(5),
    String(edgeCount).padStart(6),
    formatMs(prepareMs).padStart(10),
    formatMs(compileMs).padStart(11),
    String(jsonBytes).padStart(13),
    inLimits,
  ].join(' | '))
}
