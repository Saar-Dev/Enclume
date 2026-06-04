// Face culling voxel mesher — adapté depuis threejs.org/manual (voxel geometry with culled faces)
// Seule adaptation : UVs [0,1] directs (pas d'atlas) + groupement par (texId × face physique P32).
//
// P32 — ordre faces BoxGeometry : east(0), west(1), top(2), bottom(3), south(4), north(5)
// physIdx sur chaque face = index matériau P32 correspondant à cette direction.

const FACES = [
  { dir: [-1, 0, 0], physIdx: 1, corners: [ // west  — P32 idx 1
    { pos: [0, 1, 0], uv: [0, 1] },
    { pos: [0, 0, 0], uv: [0, 0] },
    { pos: [0, 1, 1], uv: [1, 1] },
    { pos: [0, 0, 1], uv: [1, 0] },
  ]},
  { dir: [+1, 0, 0], physIdx: 0, corners: [ // east  — P32 idx 0
    { pos: [1, 1, 1], uv: [0, 1] },
    { pos: [1, 0, 1], uv: [0, 0] },
    { pos: [1, 1, 0], uv: [1, 1] },
    { pos: [1, 0, 0], uv: [1, 0] },
  ]},
  { dir: [0, -1, 0], physIdx: 3, corners: [ // bottom — P32 idx 3
    { pos: [1, 0, 1], uv: [1, 0] },
    { pos: [0, 0, 1], uv: [0, 0] },
    { pos: [1, 0, 0], uv: [1, 1] },
    { pos: [0, 0, 0], uv: [0, 1] },
  ]},
  { dir: [0, +1, 0], physIdx: 2, corners: [ // top   — P32 idx 2
    { pos: [0, 1, 1], uv: [1, 1] },
    { pos: [1, 1, 1], uv: [0, 1] },
    { pos: [0, 1, 0], uv: [1, 0] },
    { pos: [1, 1, 0], uv: [0, 0] },
  ]},
  { dir: [0, 0, -1], physIdx: 5, corners: [ // north — P32 idx 5
    { pos: [1, 0, 0], uv: [0, 0] },
    { pos: [0, 0, 0], uv: [1, 0] },
    { pos: [1, 1, 0], uv: [0, 1] },
    { pos: [0, 1, 0], uv: [1, 1] },
  ]},
  { dir: [0, 0, +1], physIdx: 4, corners: [ // south — P32 idx 4
    { pos: [0, 0, 1], uv: [0, 0] },
    { pos: [1, 0, 1], uv: [1, 0] },
    { pos: [0, 1, 1], uv: [0, 1] },
    { pos: [1, 1, 1], uv: [1, 1] },
  ]},
]

// ROTATION_FACE_MAP[r][physIdx] → origPhysIdx
// Pour un cube en rotation r, face visible dans la direction monde physIdx,
// retourne l'index de face orignal (avant rotation) dont on prend la texture.
//
// r = 0..3 (quarts de tour axe Y, identique à Voxel.jsx rotation * Math.PI/2)
// physIdx P32 : east(0) west(1) top(2) bottom(3) south(4) north(5)
// Top/bottom inchangés par rotation Y. Table vérifiée par composition (groupe cyclique ordre 4).
const ROTATION_FACE_MAP = [
  [0, 1, 2, 3, 4, 5], // r=0 : 0°   identité
  [4, 5, 2, 3, 1, 0], // r=1 : 90°  E←S  W←N  S←W  N←E
  [1, 0, 2, 3, 5, 4], // r=2 : 180° E←W  W←E  S←N  N←S
  [5, 4, 2, 3, 0, 1], // r=3 : 270° E←N  W←S  S←E  N←W
]

// buildCulledMesh — fonction pure, pas de Three.js, pas de React.
// Entrée  : voxels = { "x:y:z": { x, y, z, tex, geo, r } }
// Sortie  : groups = { [`${texId}_${origPhysIdx}`]: { texId, physIdx, positions[], normals[], uvs[], indices[] } }
//
// Seuls les cubes (geo === 'cube') sont traités — slabs/slopes/wedges restent en <Voxel> individuel.
// Phase B : origPhysIdx = ROTATION_FACE_MAP[r][physIdx] détermine la texture source par face.
export function buildCulledMesh(voxels) {
  const groups = {}

  for (const v of Object.values(voxels)) {
    if (v.geo !== 'cube') continue

    for (const { dir, physIdx, corners } of FACES) {
      const neighborKey = `${v.x + dir[0]}:${v.y + dir[1]}:${v.z + dir[2]}`
      const neighbor = voxels[neighborKey]
      // Ne culling que face contre face cube — slab/slope/wedge n'occupe pas la case entière
      if (neighbor?.geo === 'cube') continue

      const origPhysIdx = ROTATION_FACE_MAP[v.r || 0][physIdx]
      const key = `${v.tex}_${origPhysIdx}`
      if (!groups[key]) {
        groups[key] = { texId: v.tex, physIdx: origPhysIdx, positions: [], normals: [], uvs: [], indices: [] }
      }

      const g = groups[key]
      const ndx = g.positions.length / 3
      for (const { pos, uv } of corners) {
        g.positions.push(v.x + pos[0], v.y + pos[1], v.z + pos[2])
        g.normals.push(dir[0], dir[1], dir[2])
        g.uvs.push(uv[0], uv[1])
      }
      g.indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3)
    }
  }

  return groups
}