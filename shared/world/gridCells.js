import { normalizeWorldPoint } from './worldMetrics.js'

// Modèle « à la case » (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.3) : un token occupe une case, un
// segment qui la traverse ou y arrive la concerne.
//
// Une case est une dalle de sol de UNE unité monde de côté : le compilateur crée une dalle par cellule
// entière [x, x+1] × [z, z+1] (worldCompiler.js, addSlabs / roomFloorEntries). La case d'un point est donc
// (floor(x), floor(z)) ; l'étage est porté par l'altitude, jamais par cet index horizontal.
const EPSILON = 1e-9

export function cellOfPoint(point) {
  const p = normalizeWorldPoint(point, 'point')
  return Object.freeze({ x: Math.floor(p.x), z: Math.floor(p.z) })
}

export function cellKey(cell) {
  return `${cell.x}:${cell.z}`
}

// Cases traversées par le segment [from, to], projeté à l'horizontale, dans l'ordre du parcours.
// Parcours de grille exact (Amanatides & Woo, « A Fast Voxel Traversal Algorithm for Ray Tracing »,
// Eurographics 1987), variante « supercover » : une case seulement effleurée compte. Un passage par un
// coin inclut donc les DEUX cases voisines du coin, en plus de la case en diagonale.
//
// Chaque entrée porte `enterRatio` / `exitRatio` ∈ [0, 1] (position sur le segment 3D, altitude
// comprise) : l'appelant en déduit l'altitude de la ligne dans la case (createSegmentCellPredicate).
export function cellsCrossedBySegment(from, to) {
  const a = normalizeWorldPoint(from, 'from')
  const b = normalizeWorldPoint(to, 'to')
  const dx = b.x - a.x
  const dz = b.z - a.z

  let cellX = Math.floor(a.x)
  let cellZ = Math.floor(a.z)
  if (Math.abs(dx) <= EPSILON && Math.abs(dz) <= EPSILON) {
    return Object.freeze([Object.freeze({ x: cellX, z: cellZ, enterRatio: 0, exitRatio: 1 })])
  }

  const stepX = Math.abs(dx) <= EPSILON ? 0 : Math.sign(dx)
  const stepZ = Math.abs(dz) <= EPSILON ? 0 : Math.sign(dz)
  const tDeltaX = stepX === 0 ? Infinity : 1 / Math.abs(dx)
  const tDeltaZ = stepZ === 0 ? Infinity : 1 / Math.abs(dz)
  let tMaxX = stepX === 0 ? Infinity : (stepX > 0 ? (cellX + 1 - a.x) : (a.x - cellX)) * tDeltaX
  let tMaxZ = stepZ === 0 ? Infinity : (stepZ > 0 ? (cellZ + 1 - a.z) : (a.z - cellZ)) * tDeltaZ

  const cells = []
  const push = (x, z, enterRatio, exitRatio) => {
    cells.push(Object.freeze({ x, z, enterRatio, exitRatio }))
  }

  let enter = 0
  // Garde-fou : un segment de N cases ne franchit jamais plus de 2N frontières.
  const maxSteps = Math.ceil(Math.abs(dx) + Math.abs(dz)) * 2 + 4
  for (let iteration = 0; iteration < maxSteps; iteration++) {
    const next = Math.min(tMaxX, tMaxZ)
    if (next > 1 + EPSILON) {
      push(cellX, cellZ, enter, 1)
      break
    }
    push(cellX, cellZ, enter, next)
    const crossesCorner = Math.abs(tMaxX - tMaxZ) <= EPSILON
    if (crossesCorner) {
      // Coin : les deux cases qui touchent le coin comptent (effleurées), puis on passe en diagonale.
      push(cellX + stepX, cellZ, next, next)
      push(cellX, cellZ + stepZ, next, next)
      cellX += stepX
      cellZ += stepZ
      tMaxX += tDeltaX
      tMaxZ += tDeltaZ
    } else if (tMaxX < tMaxZ) {
      cellX += stepX
      tMaxX += tDeltaX
    } else {
      cellZ += stepZ
      tMaxZ += tDeltaZ
    }
    enter = next
    if (next >= 1 - EPSILON) {
      // Le segment finit exactement sur une frontière : la case d'arrivée est effleurée, elle compte.
      push(cellX, cellZ, next, 1)
      break
    }
  }
  return Object.freeze(cells)
}

// Prédicat « ce nœud de navigation est-il sur la trajectoire ? » : la case du nœud est traversée par le
// segment ET la ligne passe, dans cette case, à une hauteur que le corps du token peut occuper (entre le
// sol du nœud et le sol + `bodyHeight`, en unités monde). Pur : ne lit ni base ni snapshot.
//
// Un nœud porte `point.y` = dessus de la dalle (worldCompiler nodePointFromSupport) ; deux étages
// superposés partagent le même (x, z) mais pas la même altitude, d'où le test vertical.
export function createSegmentCellPredicate(from, to, { bodyHeight } = {}) {
  const height = Number(bodyHeight)
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError('bodyHeight doit être un nombre positif (unités monde)')
  }
  const a = normalizeWorldPoint(from, 'from')
  const b = normalizeWorldPoint(to, 'to')
  const crossed = new Map(cellsCrossedBySegment(a, b).map(cell => [cellKey(cell), cell]))
  const altitudeAt = ratio => a.y + (b.y - a.y) * ratio
  return node => {
    const cell = crossed.get(cellKey(cellOfPoint(node.point)))
    if (!cell) return false
    const lineLow = Math.min(altitudeAt(cell.enterRatio), altitudeAt(cell.exitRatio))
    const lineHigh = Math.max(altitudeAt(cell.enterRatio), altitudeAt(cell.exitRatio))
    return lineHigh >= node.point.y - EPSILON && lineLow <= node.point.y + height + EPSILON
  }
}
