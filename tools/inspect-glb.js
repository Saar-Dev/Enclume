// tools/inspect-glb.js — normales K-means + extraction texture albedo
// Usage: node tools/inspect-glb.js <path.glb> <K>
// K = nombre de faces (4=D4, 6=D6, 8=D8, 10=D10/D12, 12=D12, 20=D20)
// Produit aussi <nom>_albedo.png/jpg dans le même dossier que le .glb

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname }               from 'path'

const filePath = process.argv[2]
const K        = parseInt(process.argv[3]) || 4

if (!filePath) {
  console.error('Usage: node tools/inspect-glb.js <path.glb> <K>')
  process.exit(1)
}

// ─── 1. Parse GLB ─────────────────────────────────────────────────────────────
const buf      = readFileSync(filePath)
const magic    = buf.readUInt32LE(0)
if (magic !== 0x46546C67) throw new Error('Pas un fichier GLB valide')

const jsonLen  = buf.readUInt32LE(12)
const jsonStr  = buf.subarray(20, 20 + jsonLen).toString('utf8')
const gltf     = JSON.parse(jsonStr)
const binStart = 20 + jsonLen + 8

function readAccessor(idx) {
  const acc    = gltf.accessors[idx]
  const bv     = gltf.bufferViews[acc.bufferView]
  const dim    = { VEC2: 2, VEC3: 3, SCALAR: 1 }[acc.type] ?? 1
  const cb     = (acc.componentType === 5126 || acc.componentType === 5125) ? 4 : 2
  const stride = bv.byteStride ?? (dim * cb)
  const base   = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const out    = []
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

// ─── 2. Normales et UVs par triangle ─────────────────────────────────────────
// Normales calculées depuis les positions (produit vectoriel) — immunisé contre
// le smooth shading. Les normales stockées dans NORMAL sont interpolées aux
// vertices et donnent des clusters K-means imprécis sur les faces lisses.
const prim      = gltf.meshes[0].primitives[0]
const positions = readAccessor(prim.attributes.POSITION)
const uvs       = prim.attributes.TEXCOORD_0 !== undefined
                    ? readAccessor(prim.attributes.TEXCOORD_0) : null
const idxRaw    = prim.indices !== undefined
                    ? readAccessor(prim.indices).flat() : null

const triCount   = idxRaw ? idxRaw.length / 3 : positions.length / 3
const triNormals = []
const triUVs     = []

for (let i = 0; i < triCount; i++) {
  const vi = idxRaw
    ? [idxRaw[i*3], idxRaw[i*3+1], idxRaw[i*3+2]]
    : [i*3, i*3+1, i*3+2]

  // Normale géométrique : produit vectoriel des arêtes (winding CCW glTF → normal sortante)
  const p0 = positions[vi[0]], p1 = positions[vi[1]], p2 = positions[vi[2]]
  const e1x = p1[0]-p0[0], e1y = p1[1]-p0[1], e1z = p1[2]-p0[2]
  const e2x = p2[0]-p0[0], e2y = p2[1]-p0[1], e2z = p2[2]-p0[2]
  const nx = e1y*e2z - e1z*e2y
  const ny = e1z*e2x - e1x*e2z
  const nz = e1x*e2y - e1y*e2x
  const l  = Math.sqrt(nx*nx + ny*ny + nz*nz)
  triNormals.push(l > 1e-10 ? [nx/l, ny/l, nz/l] : [0,1,0])

  if (uvs) {
    triUVs.push([
      (uvs[vi[0]][0] + uvs[vi[1]][0] + uvs[vi[2]][0]) / 3,
      (uvs[vi[0]][1] + uvs[vi[1]][1] + uvs[vi[2]][1]) / 3,
    ])
  }
}

// ─── 3. K-means sur la sphère unité ──────────────────────────────────────────
function runKmeans(points, k, seed = 0) {
  let s = seed | 1
  const rand = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0xFFFFFFFF }

  const centers = []
  centers.push(points[Math.floor(rand() * points.length)].slice())
  for (let c = 1; c < k; c++) {
    const dists = points.map(p => {
      let maxDot = -1
      for (const ctr of centers) {
        const d = p[0]*ctr[0] + p[1]*ctr[1] + p[2]*ctr[2]
        if (d > maxDot) maxDot = d
      }
      return 1 - maxDot
    })
    let maxD = -1, maxI = 0
    for (let i = 0; i < dists.length; i++) if (dists[i] > maxD) { maxD = dists[i]; maxI = i }
    centers.push(points[maxI].slice())
  }

  const assign = new Int32Array(points.length)
  for (let iter = 0; iter < 100; iter++) {
    let changed = false
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      let best = 0, bestDot = -Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = p[0]*centers[c][0] + p[1]*centers[c][1] + p[2]*centers[c][2]
        if (d > bestDot) { bestDot = d; best = c }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true }
    }
    if (!changed) break
    for (let c = 0; c < centers.length; c++) {
      let cx = 0, cy = 0, cz = 0, n = 0
      for (let i = 0; i < points.length; i++) {
        if (assign[i] === c) { cx += points[i][0]; cy += points[i][1]; cz += points[i][2]; n++ }
      }
      if (n === 0) continue
      const l = Math.sqrt(cx*cx + cy*cy + cz*cz)
      centers[c] = [cx/l, cy/l, cz/l]
    }
  }

  let score = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i], c = centers[assign[i]]
    score += p[0]*c[0] + p[1]*c[1] + p[2]*c[2]
  }
  return { centers, assign, score }
}

let best = null
for (let s = 0; s < 12; s++) {
  const r = runKmeans(triNormals, K, s * 31337)
  if (!best || r.score > best.score) best = r
}
const { centers, assign } = best

// ─── 4. Stats par cluster ─────────────────────────────────────────────────────
const stats = centers.map((c, ci) => {
  const indices = []
  for (let i = 0; i < triNormals.length; i++) if (assign[i] === ci) indices.push(i)
  const n = indices.length

  let au = 0, av = 0
  if (uvs) {
    for (const i of indices) { au += triUVs[i][0]; av += triUVs[i][1] }
    au /= n; av /= n
  }

  let nx = 0, ny = 0, nz = 0
  for (const i of indices) { nx += triNormals[i][0]; ny += triNormals[i][1]; nz += triNormals[i][2] }
  const l = Math.sqrt(nx*nx + ny*ny + nz*nz)
  const finalNorm = l > 1e-6 ? [nx/l, ny/l, nz/l] : c

  // Variance : angle max + noyau serré (< 1°) — flat face vs parois gravure
  let maxAngleDeg = 0, tightCount = 0
  for (const i of indices) {
    const t = triNormals[i]
    const dot = Math.min(1, Math.max(-1, t[0]*finalNorm[0] + t[1]*finalNorm[1] + t[2]*finalNorm[2]))
    const deg = Math.acos(dot) * 180 / Math.PI
    if (deg > maxAngleDeg) maxAngleDeg = deg
    if (deg < 1.0) tightCount++
  }

  return { center: finalNorm, triCount: n, uvCenter: uvs ? [au, av] : null, maxAngleDeg, tightCount }
})

stats.sort((a, b) => b.triCount - a.triCount)

// ─── 5. Affichage clusters ────────────────────────────────────────────────────
const fname = filePath.split(/[/\\]/).pop()
console.log(`\n=== ${fname} — ${triCount} triangles, K=${K} ===\n`)

const f = (v) => v.toFixed(4).padStart(8)
for (let i = 0; i < stats.length; i++) {
  const s = stats[i]
  const n = s.center
  const spread = `  tight=${String(s.tightCount).padStart(2)}/${String(s.triCount).padStart(2)}  max ${s.maxAngleDeg.toFixed(2)}°`
  let uvInfo = ''
  if (s.uvCenter) uvInfo = ` | UV [${s.uvCenter[0].toFixed(3)}, ${s.uvCenter[1].toFixed(3)}]`
  console.log(`Cluster ${String(i+1).padStart(2)} (${String(s.triCount).padStart(3)} tri) : [${f(n[0])}, ${f(n[1])}, ${f(n[2])}]${uvInfo}${spread}`)
}

// ─── 6. Extraction de la texture albedo ──────────────────────────────────────
const matIdx = prim.material ?? 0
const mat    = gltf.materials?.[matIdx]
const texRef = mat?.pbrMetallicRoughness?.baseColorTexture

if (texRef !== undefined) {
  const texIdx = texRef.index
  const imgIdx = gltf.textures[texIdx].source
  const img    = gltf.images[imgIdx]
  const bv     = gltf.bufferViews[img.bufferView]
  const offset = binStart + (bv.byteOffset ?? 0)
  const imgBuf = buf.subarray(offset, offset + bv.byteLength)
  const ext    = img.mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const baseName = fname.replace(/\.glb$/i, '')
  const outPath  = join(dirname(filePath), `${baseName}_albedo.${ext}`)
  writeFileSync(outPath, imgBuf)

  // Dimensions de l'image pour convertir UV → pixels
  let imgW = 0, imgH = 0
  if (img.mimeType === 'image/png') {
    imgW = imgBuf.readUInt32BE(16)
    imgH = imgBuf.readUInt32BE(20)
  } else {
    // JPEG : scanner pour marqueur SOF0 (0xFF 0xC0) ou SOF2 (0xFF 0xC2)
    for (let i = 0; i < imgBuf.length - 8; i++) {
      if (imgBuf[i] === 0xFF && (imgBuf[i+1] === 0xC0 || imgBuf[i+1] === 0xC2)) {
        imgH = imgBuf.readUInt16BE(i+5)
        imgW = imgBuf.readUInt16BE(i+7)
        break
      }
    }
  }

  console.log(`\n--- Texture albedo extraite : ${outPath} (${imgW}×${imgH} px) ---`)
  console.log('Ouvrir l\'image et relever le chiffre à chaque coordonnée pixel :\n')
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]
    if (!s.uvCenter) continue
    const px = Math.round(s.uvCenter[0] * imgW)
    const py = Math.round(s.uvCenter[1] * imgH)
    const n  = s.center
    console.log(`  Cluster ${String(i+1).padStart(2)} | UV [${s.uvCenter[0].toFixed(3)}, ${s.uvCenter[1].toFixed(3)}] | pixel [${String(px).padStart(4)}, ${String(py).padStart(4)}] | normal [${f(n[0])},${f(n[1])},${f(n[2])}]`)
  }
  console.log('\nNote : UV origin = coin haut-gauche de l\'image (convention glTF).')
} else {
  console.log('\n(Pas de texture albedo trouvée dans ce .glb)')
  // Fallback : copier-coller pour FACE_NORMALS
  console.log('\n--- Copier dans FACE_NORMALS (valeur à identifier manuellement) ---')
  for (let i = 0; i < stats.length; i++) {
    const n = stats[i].center
    console.log(`  ?: [${n[0].toFixed(4)}, ${n[1].toFixed(4)}, ${n[2].toFixed(4)}],`)
  }
}
