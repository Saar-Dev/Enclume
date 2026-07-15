// buildDungeonTerrainMesh.js
// Prototype "tactical diorama" renderer data.
//
// Converts the current voxel_data into a heightfield:
// - one visible floor per occupied X/Z column
// - vertical wall skirts when the neighbor column is lower or empty
//
// This is intentionally render-only. It does not change voxel_data, collision,
// pathfinding, PE14, or editor behavior.

const FACE = {
  east: 0,
  west: 1,
  top: 2,
  bottom: 3,
  south: 4,
  north: 5,
}

const DIRS = [
  { dx: 1, dz: 0, physIdx: FACE.east, normal: [1, 0, 0], side: 'east' },
  { dx: -1, dz: 0, physIdx: FACE.west, normal: [-1, 0, 0], side: 'west' },
  { dx: 0, dz: 1, physIdx: FACE.south, normal: [0, 0, 1], side: 'south' },
  { dx: 0, dz: -1, physIdx: FACE.north, normal: [0, 0, -1], side: 'north' },
]

const FLOOR_INSET = 0.08
const BEVEL_DROP = 0.12

function surfaceTop(v) {
  if (v.geo === 'slab_bottom') return v.y + 0.5
  return v.y + 1.0
}

function columnKey(x, z) {
  return `${x}:${z}`
}

function ensureGroup(groups, texId, physIdx, role) {
  const key = `${texId}_${physIdx}_${role}`
  if (!groups[key]) {
    groups[key] = { texId, physIdx, role, positions: [], normals: [], uvs: [], indices: [] }
  }
  return groups[key]
}

function addQuad(group, corners, normal) {
  const ndx = group.positions.length / 3
  const uvs = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]

  for (let i = 0; i < corners.length; i++) {
    group.positions.push(corners[i][0], corners[i][1], corners[i][2])
    group.normals.push(normal[0], normal[1], normal[2])
    group.uvs.push(uvs[i][0], uvs[i][1])
  }

  group.indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3)
}

function addTop(groups, column) {
  const g = ensureGroup(groups, column.tex, FACE.top, 'floor')
  const x0 = column.x + FLOOR_INSET
  const x1 = column.x + 1 - FLOOR_INSET
  const z0 = column.z + FLOOR_INSET
  const z1 = column.z + 1 - FLOOR_INSET
  const y = column.top

  addQuad(g, [
    [x0, y, z1],
    [x1, y, z1],
    [x0, y, z0],
    [x1, y, z0],
  ], [0, 1, 0])
}

function bevelNormal(dir) {
  const x = dir.normal[0] * 0.65
  const y = 0.75
  const z = dir.normal[2] * 0.65
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

function addBevel(groups, column, dir) {
  const top = column.top
  const low = Math.max(0, top - BEVEL_DROP)
  const g = ensureGroup(groups, column.tex, FACE.top, 'bevel')
  const normal = bevelNormal(dir)

  const x0 = column.x
  const x1 = column.x + 1
  const z0 = column.z
  const z1 = column.z + 1
  const ix0 = column.x + FLOOR_INSET
  const ix1 = column.x + 1 - FLOOR_INSET
  const iz0 = column.z + FLOOR_INSET
  const iz1 = column.z + 1 - FLOOR_INSET

  if (dir.side === 'east') {
    addQuad(g, [
      [x1, low, iz0],
      [x1, low, iz1],
      [ix1, top, iz0],
      [ix1, top, iz1],
    ], normal)
    return
  }

  if (dir.side === 'west') {
    addQuad(g, [
      [x0, low, iz1],
      [x0, low, iz0],
      [ix0, top, iz1],
      [ix0, top, iz0],
    ], normal)
    return
  }

  if (dir.side === 'south') {
    addQuad(g, [
      [ix1, low, z1],
      [ix0, low, z1],
      [ix1, top, iz1],
      [ix0, top, iz1],
    ], normal)
    return
  }

  addQuad(g, [
    [ix0, low, z0],
    [ix1, low, z0],
    [ix0, top, iz0],
    [ix1, top, iz0],
  ], normal)
}

function addWall(groups, column, neighbor, dir) {
  const neighborTop = neighbor?.top ?? 0
  if (neighborTop >= column.top) return

  const bottom = neighborTop
  const top = Math.max(bottom, column.top - BEVEL_DROP)
  if (top <= bottom) return
  const g = ensureGroup(groups, column.tex, dir.physIdx, 'wall')

  const x0 = column.x
  const x1 = column.x + 1
  const z0 = column.z
  const z1 = column.z + 1

  if (dir.side === 'east') {
    addQuad(g, [
      [x1, bottom, z1],
      [x1, bottom, z0],
      [x1, top, z1],
      [x1, top, z0],
    ], dir.normal)
    return
  }

  if (dir.side === 'west') {
    addQuad(g, [
      [x0, bottom, z0],
      [x0, bottom, z1],
      [x0, top, z0],
      [x0, top, z1],
    ], dir.normal)
    return
  }

  if (dir.side === 'south') {
    addQuad(g, [
      [x0, bottom, z1],
      [x1, bottom, z1],
      [x0, top, z1],
      [x1, top, z1],
    ], dir.normal)
    return
  }

  addQuad(g, [
    [x1, bottom, z0],
    [x0, bottom, z0],
    [x1, top, z0],
    [x0, top, z0],
  ], dir.normal)
}

export function buildDungeonTerrainMesh(voxels) {
  const columns = {}

  for (const v of Object.values(voxels)) {
    const key = columnKey(v.x, v.z)
    const top = surfaceTop(v)
    const existing = columns[key]
    if (!existing || top > existing.top) {
      columns[key] = { x: v.x, z: v.z, top, tex: v.tex, geo: v.geo }
    }
  }

  const groups = {}
  const orderedColumns = Object.values(columns)

  for (const column of orderedColumns) {
    addTop(groups, column)

    for (const dir of DIRS) {
      addBevel(groups, column, dir)
      const neighbor = columns[columnKey(column.x + dir.dx, column.z + dir.dz)]
      addWall(groups, column, neighbor, dir)
    }
  }

  return groups
}
