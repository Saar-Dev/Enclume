// shared/world/mapTestFixtures.mjs
// Cartes de test saines et piégées, construites en mémoire (aucun fichier binaire) — segment S0 du chantier « éditeur de
// carte » : docs/PLANS/PLAN_EXPORT_CARTE.md §8 et §12.
// Le nom ne finit pas par `.test.mjs` : ce module n'est pas exécuté seul par `node --test 'shared/**/*.test.mjs'`.
// Les salles sont décrites par leurs cases explicites, comme l'éditeur les produit (`cells`, clés « x:z »).

export function emptySurface(patch = {}) {
  return {
    version: 12,
    fine: 4,
    storyHeight: 2.5,
    rooms: {},
    floors: {},
    walls: {},
    ceilings: {},
    stairs: {},
    connectors: {},
    ...patch,
  }
}

export function baseRoom(patch = {}) {
  return {
    minX: 0,
    maxX: 0,
    minZ: 0,
    maxZ: 0,
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
    ...patch,
  }
}

// Salle rectangulaire pleine width × depth dont le coin est en (originX, originZ).
export function rectangleRoom(width, depth, { originX = 0, originZ = 0, ...patch } = {}) {
  const cells = []
  for (let z = originZ; z < originZ + depth; z += 1) {
    for (let x = originX; x < originX + width; x += 1) cells.push(`${x}:${z}`)
  }
  return baseRoom({
    minX: originX,
    maxX: originX + width - 1,
    minZ: originZ,
    maxZ: originZ + depth - 1,
    cells,
    ...patch,
  })
}

export function squareRoom(size, patch = {}) {
  return rectangleRoom(size, size, patch)
}

// Salle « en damier » : une case sur deux, donc des cases isolées — pire cas de complexité de contour
// (4 arêtes de contour par case). Mesuré : un damier 16×16 met ~5 s à compiler, un 30×30 plus de 2 minutes.
export function checkerboardRoom(size, patch = {}) {
  const cells = []
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) if ((x + z) % 2 === 0) cells.push(`${x}:${z}`)
  }
  return baseRoom({ minX: 0, maxX: size - 1, minZ: 0, maxZ: size - 1, cells, ...patch })
}

// Petite carte saine et réaliste : deux salles voisines et une porte (modèle intégré désigné par sa clé naturelle).
export function healthySurface() {
  return emptySurface({
    rooms: {
      'room:0:0:9:7:0:1': rectangleRoom(10, 8),
      'room:10:0:15:5:0:1': rectangleRoom(6, 6, { originX: 10 }),
    },
    connectors: {
      'door:z:10:2': {
        type: 'door',
        axis: 'z',
        state: 'closed',
        x0: 40,
        x1: 40,
        z0: 8,
        z1: 12,
        y: 0,
        roomIds: ['room:0:0:9:7:0:1', 'room:10:0:15:5:0:1'],
        modelBuiltinKey: 'futuristic_doors/06_large_hangar_door_4x3m',
        modelLabel: 'Grande porte de hangar',
      },
    },
  })
}

// Tableaux imbriqués `depth` fois (le plus profond contient un tableau vide), construits SANS récursion.
export function nestedArrays(depth) {
  let value = []
  for (let level = 1; level < depth; level += 1) value = [value]
  return value
}

export function wideArray(length, fill = 0) {
  return new Array(length).fill(fill)
}
