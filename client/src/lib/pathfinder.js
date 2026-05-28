// pathfinder.js — A* Chebyshev pathfinding for Enclume VTT
// Double resolution ×2 : 1 Three.js unit = 2 gridY nodes (handles slab_bottom natively)
// Chebyshev movement : 8 directions, cost = 1 per cell regardless of diagonal
// PE14 : token.pos_y = Z Three.js (depth), token.pos_z = Y Three.js (altitude)
// PE34 : token group center at pos_z+0.5, feet at pos_z+1.0 → startFeetGY = (posZ+1)*2

// ─── Binary min-heap ─────────────────────────────────────────────────────────

class MinHeap {
  constructor(cmp) {
    this._data = []
    this._cmp  = cmp
  }

  push(item) {
    this._data.push(item)
    this._up(this._data.length - 1)
  }

  pop() {
    const top  = this._data[0]
    const last = this._data.pop()
    if (this._data.length > 0) {
      this._data[0] = last
      this._down(0)
    }
    return top
  }

  isEmpty() { return this._data.length === 0 }

  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this._cmp(this._data[i], this._data[p]) < 0) {
        ;[this._data[i], this._data[p]] = [this._data[p], this._data[i]]
        i = p
      } else break
    }
  }

  _down(i) {
    const n = this._data.length
    for (;;) {
      let s = i
      const l = 2 * i + 1, r = 2 * i + 2
      if (l < n && this._cmp(this._data[l], this._data[s]) < 0) s = l
      if (r < n && this._cmp(this._data[r], this._data[s]) < 0) s = r
      if (s === i) break
      ;[this._data[i], this._data[s]] = [this._data[s], this._data[i]]
      i = s
    }
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIRS = [
  [ 1,  0], [-1,  0], [ 0,  1], [ 0, -1],
  [ 1,  1], [ 1, -1], [-1,  1], [-1, -1],
]

const nodeKey = (x, gy, z) => `${x}:${gy}:${z}`

// ─── Blocked-cells set ───────────────────────────────────────────────────────

function buildBlockedSet(voxels, tokens, entities, excludeTokenId) {
  const blocked = new Set()

  // Voxels (keys are Three.js coords: v.y = altitude)
  for (const v of Object.values(voxels)) {
    const base = v.y * 2
    if (v.geo === 'slab_bottom') {
      blocked.add(`${v.x}:${base}:${v.z}`)
    } else if (v.geo === 'slab_top') {
      blocked.add(`${v.x}:${base + 1}:${v.z}`)
    } else {
      // cube, slope, wedge → full block (slope/wedge simplified as cube in V1)
      blocked.add(`${v.x}:${base}:${v.z}`)
      blocked.add(`${v.x}:${base + 1}:${v.z}`)
    }
  }

  // Tokens (PE14: pos_y = Z Three.js depth, pos_z = Y Three.js altitude)
  // PE34 fix: feet at pos_z+1.0 Three.js → feetGY = (pos_z+1)*2 (not pos_z*2)
  for (const t of tokens) {
    if (t.id === excludeTokenId) continue
    const feetGY = (t.pos_z + 1) * 2
    for (let i = 0; i < 4; i++) {
      blocked.add(`${t.pos_x}:${feetGY + i}:${t.pos_y}`)
    }
  }

  // Entities V1 : 1×1 footprint, blocking if is_blocking
  // Callers pass [] for V1 since entity.state?.is_blocking is uncertain
  for (const e of entities) {
    if (!e.state?.is_blocking) continue
    const base = e.pos_z * 2
    blocked.add(`${e.pos_x}:${base}:${e.pos_y}`)
    blocked.add(`${e.pos_x}:${base + 1}:${e.pos_y}`)
  }

  return blocked
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Returns true if gridY cells feetGY..feetGY+charHeight-1 are all free
function isBodyClear(blocked, x, z, feetGY, charHeight) {
  for (let i = 0; i < charHeight; i++) {
    if (blocked.has(`${x}:${feetGY + i}:${z}`)) return false
  }
  return true
}

// Returns true if there is a solid cell directly below feetGY AND body fits above
function isValidFeet(blocked, x, z, feetGY, charHeight) {
  if (feetGY < 1) return false
  if (!blocked.has(`${x}:${feetGY - 1}:${z}`)) return false
  return isBodyClear(blocked, x, z, feetGY, charHeight)
}

// ─── Neighbor expansion ───────────────────────────────────────────────────────

// For each of 8 Chebyshev directions, scan from feetGY+maxStepUp down to
// feetGY-maxScanDown. First valid feet position is the natural surface of that
// cell (handles step-up, same-level, and free-fall in one unified pass).
function getNeighbors(blocked, x, feetGY, z, charHeight, maxStepUp, maxScanDown) {
  const neighbors = []

  for (const [dx, dz] of DIRS) {
    const nx = x + dx, nz = z + dz

    for (let nfy = feetGY + maxStepUp; nfy >= feetGY - maxScanDown; nfy--) {
      if (nfy < 1) break
      if (isValidFeet(blocked, nx, nz, nfy, charHeight)) {
        neighbors.push({ x: nx, z: nz, feetGY: nfy })
        break
      }
    }
  }

  return neighbors
}

// ─── Path reconstruction ─────────────────────────────────────────────────────

function reconstructPath(parent, goal) {
  const path = []
  let cur = { x: goal.x, gy: goal.gy, z: goal.z }

  while (cur) {
    path.unshift({ x: cur.x, z: cur.z, feetGridY: cur.gy })
    const k = nodeKey(cur.x, cur.gy, cur.z)
    cur = parent.has(k) ? parent.get(k) : null
  }

  path.forEach((p, i) => { p.distFromStart = i })
  return path
}

// ─── Main export: findPath ───────────────────────────────────────────────────

/**
 * A* pathfinding.
 *
 * @param {Object}  voxels         - Canvas3D local state: { "x:y:z": { x, y, z, geo } }
 * @param {Array}   tokens         - Token array from useTokenStore (PE14 convention)
 * @param {Array}   entities       - Entity array (pass [] for V1)
 * @param {Object}  from           - { x, z, posZ } — posZ = token.pos_z (DB altitude)
 * @param {Object}  to             - { x, z } — destination in Three.js floor coords
 * @param {Object}  allures        - { lente, moyenne, rapide, max } in cells (from calcAllures)
 * @param {Object}  [options]
 * @returns {Array|null}  Path array [{ x, z, feetGridY, distFromStart }] or null if unreachable
 *
 * Path length - 1 = number of steps (pass to getActionKey).
 * feetGridY / 2 = Three.js feet height (use for indicator position.y).
 * targetPosZ (DB) = Math.round(dest.feetGridY / 2) - 1 (PE14 altitude for server payload).
 */
export function findPath(voxels, tokens, entities, from, to, allures, options = {}) {
  const {
    charHeight     = 4,   // gridY units (= 2 Three.js: standard humanoid)
    maxStepUp      = 2,   // gridY units (= 1 Three.js: one full block or two slabs)
    maxScanDown    = 40,  // gridY units (= 20 Three.js: free fall depth limit)
    excludeTokenId = null,
  } = options

  // Issue B: destination = start → no movement
  if (from.x === to.x && from.z === to.z) return null

  const blocked = buildBlockedSet(voxels, tokens, entities, excludeTokenId)

  // PE34: feet at pos_z + 1.0 Three.js, not pos_z
  const startFeetGY = (from.posZ + 1) * 2
  const startKey    = nodeKey(from.x, startFeetGY, from.z)

  // Chebyshev heuristic — admissible (never overestimates)
  const h = (x, z) => Math.max(Math.abs(x - to.x), Math.abs(z - to.z))

  const heap   = new MinHeap((a, b) => a.f - b.f)
  const gScore = new Map([[startKey, 0]])
  const parent = new Map()

  heap.push({ x: from.x, gy: startFeetGY, z: from.z, g: 0, f: h(from.x, from.z) })

  let iterations = 0
  const MAX_ITER = 5000

  while (!heap.isEmpty() && iterations++ < MAX_ITER) {
    const cur    = heap.pop()
    const curKey = nodeKey(cur.x, cur.gy, cur.z)

    // Issue C: lazy deletion — skip stale heap entries
    if ((gScore.get(curKey) ?? Infinity) < cur.g) continue

    if (cur.x === to.x && cur.z === to.z) {
      return reconstructPath(parent, cur)
    }

    const curG      = gScore.get(curKey)
    const neighbors = getNeighbors(blocked, cur.x, cur.gy, cur.z, charHeight, maxStepUp, maxScanDown)

    for (const nb of neighbors) {
      const nbKey = nodeKey(nb.x, nb.feetGY, nb.z)
      const tentG = curG + 1

      if (tentG < (gScore.get(nbKey) ?? Infinity)) {
        gScore.set(nbKey, tentG)
        parent.set(nbKey, { x: cur.x, gy: cur.gy, z: cur.z })
        heap.push({ x: nb.x, gy: nb.feetGY, z: nb.z, g: tentG, f: tentG + h(nb.x, nb.z) })
      }
    }
  }

  return null
}

// ─── Allure helpers ───────────────────────────────────────────────────────────

/**
 * @param {number} steps    - path.length - 1 (start node excluded)
 * @param {Object} allures  - { lente, moyenne, rapide, max } in cells
 * @returns {{ action_key, ini_mod } | null}  null if out of range
 */
export function getActionKey(steps, allures) {
  if (steps <= allures.lente)   return { action_key: 'move_lente',   ini_mod: -3 }
  if (steps <= allures.moyenne) return { action_key: 'move_moyenne', ini_mod: -5 }
  if (steps <= allures.rapide)  return { action_key: 'move_rapide',  ini_mod: -7 }
  if (steps <= allures.max)     return { action_key: 'move_max',     ini_mod:  0 }
  return null
}

/**
 * @param {number} distFromStart  - cell index in path (0 = start)
 * @param {Object} allures
 * @returns {string}  hex color
 */
export function getPathColor(distFromStart, allures) {
  if (distFromStart <= allures.lente)   return '#3b82f6'  // bleu   — lente
  if (distFromStart <= allures.moyenne) return '#22c55e'  // vert   — moyenne
  if (distFromStart <= allures.rapide)  return '#f97316'  // orange — rapide
  if (distFromStart <= allures.max)     return '#ef4444'  // rouge  — max
  return '#444455'                                         // gris   — hors portée
}
