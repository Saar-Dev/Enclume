// tools/blender-uv-map.js — assigne chaque triangle GLB à la normale Blender exacte la plus proche
// → centroïdes UV précis pour chaque face Blender → lecture des chiffres
// Usage: node tools/blender-uv-map.js <path.glb>

import { readFileSync } from 'fs'

const BLENDER = {
   1: [-0.7949, -0.1880, -0.5769],
   2: [ 0.7949,  0.1880, -0.5769],
   3: [ 0.7949,  0.1880,  0.5769],
   4: [-0.7949, -0.1880,  0.5769],
   5: [-0.3040,  0.1880, -0.9339],
   6: [ 0.3040, -0.1880, -0.9339],
   7: [ 0.3040, -0.1880,  0.9339],
   8: [-0.3040,  0.1880,  0.9339],
   9: [-0.4909, -0.7948, -0.3569],
  10: [-0.4909, -0.7948,  0.3569],
  11: [ 0.4909,  0.7948, -0.3569],
  12: [ 0.4909,  0.7948,  0.3569],
  13: [-0.9822,  0.1880,  0.0000],
  14: [ 0.9822, -0.1880,  0.0000],
  15: [-0.1880,  0.7949, -0.5769],
  16: [ 0.1880, -0.7949, -0.5769],
  17: [-0.1880,  0.7949,  0.5769],
  18: [ 0.1880, -0.7949,  0.5769],
  19: [-0.6069,  0.7948,  0.0000],
  20: [ 0.6069, -0.7948,  0.0000],
}

const CONFIRMED = {  // BlenderKey → die number (already known)
  1:1, 4:8, 5:3, 6:4, 8:15, 10:5, 12:16, 17:13, 18:2
}

const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]

// ─── Parse GLB ────────────────────────────────────────────────────────────────
const filePath = process.argv[2] || 'client/public/models/D20.glb'
const buf = readFileSync(filePath)
if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('Pas un GLB valide')

const jsonLen  = buf.readUInt32LE(12)
const jsonStr  = buf.subarray(20, 20 + jsonLen).toString('utf8')
const gltf     = JSON.parse(jsonStr)
const binStart = 20 + jsonLen + 8

function readAccessor(idx) {
  const acc = gltf.accessors[idx]
  const bv  = gltf.bufferViews[acc.bufferView]
  const dim = { VEC2:2, VEC3:3, SCALAR:1 }[acc.type] ?? 1
  const cb  = (acc.componentType === 5126 || acc.componentType === 5125) ? 4 : 2
  const stride = bv.byteStride ?? (dim * cb)
  const base   = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const out = []
  for (let i = 0; i < acc.count; i++) {
    const row = []
    for (let j = 0; j < dim; j++) {
      const off = base + i * stride + j * cb
      if (acc.componentType === 5126)      row.push(buf.readFloatLE(off))
      else if (acc.componentType === 5125) row.push(buf.readUInt32LE(off))
      else                                 row.push(buf.readUInt16LE(off))
    }
    out.push(row)
  }
  return out
}

const prim      = gltf.meshes[0].primitives[0]
const positions = readAccessor(prim.attributes.POSITION)
const uvs       = readAccessor(prim.attributes.TEXCOORD_0)
const idxRaw    = readAccessor(prim.indices).flat()
const triCount  = idxRaw.length / 3

// ─── Assigner chaque triangle à la normale Blender la plus proche ─────────────
const bKeys    = Object.keys(BLENDER).map(Number)
const groups   = {}   // bKey → { sumU, sumV, count }
for (const k of bKeys) groups[k] = { sumU:0, sumV:0, count:0 }

for (let i = 0; i < triCount; i++) {
  const vi = [idxRaw[i*3], idxRaw[i*3+1], idxRaw[i*3+2]]
  const p0 = positions[vi[0]], p1 = positions[vi[1]], p2 = positions[vi[2]]

  const e1 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]]
  const e2 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]]
  const nx = e1[1]*e2[2] - e1[2]*e2[1]
  const ny = e1[2]*e2[0] - e1[0]*e2[2]
  const nz = e1[0]*e2[1] - e1[1]*e2[0]
  const l  = Math.sqrt(nx*nx + ny*ny + nz*nz)
  if (l < 1e-10) continue
  const n = [nx/l, ny/l, nz/l]

  let best = bKeys[0], bestDot = -Infinity
  for (const k of bKeys) {
    const d = dot(n, BLENDER[k])
    if (d > bestDot) { bestDot = d; best = k }
  }

  const u = (uvs[vi[0]][0] + uvs[vi[1]][0] + uvs[vi[2]][0]) / 3
  const v = (uvs[vi[0]][1] + uvs[vi[1]][1] + uvs[vi[2]][1]) / 3
  groups[best].sumU += u
  groups[best].sumV += v
  groups[best].count++
}

// ─── Résultats ────────────────────────────────────────────────────────────────
const W = 4096, H = 4096   // texture size (D20_albedo.png)

console.log('\n--- UV centroïdes par clé Blender ---')
console.log('Format: BlenderKey | DieFace | count | pixel[x,y] | sample-texture coord')

const sampleCoords = []
for (const k of bKeys.sort((a,b)=>a-b)) {
  const g = groups[k]
  if (g.count === 0) { console.log(`B${String(k).padStart(2)} | ? | 0 triangles — pas de match`); continue }
  const u = g.sumU / g.count
  const v = g.sumV / g.count
  const px = Math.round(u * W)
  const py = Math.round(v * H)
  const dieFace = CONFIRMED[k] ? `die ${String(CONFIRMED[k]).padStart(2)}` : '?     '
  console.log(`B${String(k).padStart(2)} | ${dieFace} | ${String(g.count).padStart(3)} tri | pixel[${String(px).padStart(4)},${String(py).padStart(4)}] | ${px},${py},B${k}`)
  sampleCoords.push(`${px},${py},B${k}`)
}

console.log('\n--- Commande sample-texture (inconnus seulement) ---')
const unknown = bKeys.filter(k => !CONFIRMED[k])
const unknownCoords = unknown.map(k => {
  const g = groups[k]
  const px = Math.round((g.sumU/g.count)*W)
  const py = Math.round((g.sumV/g.count)*H)
  return `${px},${py},B${k}`
})
console.log(`HALF=60 node tools/sample-texture.js client/public/models/D20_albedo.png \\`)
console.log('  ' + unknownCoords.join(' \\\n  '))
