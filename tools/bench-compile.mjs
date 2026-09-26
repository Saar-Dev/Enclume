// tools/bench-compile.mjs
// Banc d'essai MANUEL (hors `npm test`) du coût d'un document de carte : validation, compilation du monde et taille JSON
// pour une salle carrée N×N décrite par ses cases, comme l'éditeur la produit. Sert à régler `MAP_LIMITS`
// (shared/world/mapLimits.js) par la mesure — docs/PLANS/PLAN_EXPORT_CARTE.md §6 et §12.
//
// Usage (depuis la racine) :
//   node tools/bench-compile.mjs                    # tailles 10, 20, 30, 40, 50
//   node tools/bench-compile.mjs --sizes=10,25,40   # tailles choisies
//   node tools/bench-compile.mjs --sizes=80 --force # au-delà de 60 : le serveur de dev gèlerait ; à lancer en connaissance de cause
//
// Aucune base, aucun serveur, aucune écriture : calcul en mémoire uniquement.

import { compileSurfaceWorld } from '../shared/world/worldCompiler.js'
import { prepareSurfaceData } from '../shared/world/surfaceDocument.js'
import { MAP_LIMITS } from '../shared/world/mapLimits.js'

const DEFAULT_SIZES = [10, 20, 30, 40, 50]
const SAFE_MAX_SIZE = 60

function parseArgs(argv) {
  const force = argv.includes('--force')
  const sizesArg = argv.find(arg => arg.startsWith('--sizes='))
  const sizes = sizesArg
    ? sizesArg.slice('--sizes='.length).split(',').map(value => Number(value.trim()))
    : DEFAULT_SIZES
  if (sizes.length === 0 || sizes.some(size => !Number.isInteger(size) || size < 1)) {
    throw new Error('--sizes doit être une liste d\'entiers strictement positifs, ex. --sizes=10,20,30')
  }
  const tooBig = sizes.filter(size => size > SAFE_MAX_SIZE)
  if (tooBig.length > 0 && !force) {
    throw new Error(`Taille(s) ${tooBig.join(', ')} > ${SAFE_MAX_SIZE} : la compilation est synchrone et durerait très longtemps. Ajouter --force pour continuer.`)
  }
  return { sizes }
}

function squareRoom(size) {
  const cells = []
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) cells.push(`${x}:${z}`)
  }
  return {
    minX: 0,
    maxX: size - 1,
    minZ: 0,
    maxZ: size - 1,
    cells,
    level: 0,
    y: 0,
    heightLevels: 1,
    floorThickness: 0.25,
    ceilingThickness: 0.25,
    wallThickness: 1,
    floorEnabled: true,
    ceilingEnabled: true,
    wallEnabled: true,
    barrierType: 'solid',
    blocksMovement: true,
    blocksSight: true,
    blocksWater: true,
  }
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6
}

function formatMs(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(0)} ms`
}

function withinLimits(size) {
  const cells = size * size
  return size <= MAP_LIMITS.maxExtentCells && cells <= MAP_LIMITS.maxTotalCells ? 'oui' : 'NON'
}

const { sizes } = parseArgs(process.argv.slice(2))
const battlemapId = 'bench-compile'

console.log(`Plafonds actuels : étendue ${MAP_LIMITS.maxExtentCells}×${MAP_LIMITS.maxExtentCells}, ${MAP_LIMITS.maxTotalCells} cases au total.\n`)
console.log('taille   | cases | validation | compilation | JSON (octets) | dans les plafonds')
console.log('---------|-------|------------|-------------|---------------|------------------')

for (const size of sizes) {
  const input = { rooms: { main: squareRoom(size) } }

  const prepareStart = process.hrtime.bigint()
  const prepared = prepareSurfaceData(input, { battlemapId }).surfaceData
  const prepareMs = elapsedMs(prepareStart)

  const compileStart = process.hrtime.bigint()
  compileSurfaceWorld({ battlemapId, worldRevision: 1, surfaceData: prepared })
  const compileMs = elapsedMs(compileStart)

  const jsonBytes = Buffer.byteLength(JSON.stringify(prepared))
  console.log([
    `${size}×${size}`.padEnd(8),
    String(size * size).padStart(5),
    formatMs(prepareMs).padStart(10),
    formatMs(compileMs).padStart(11),
    String(jsonBytes).padStart(13),
    withinLimits(size),
  ].join(' | '))
}
