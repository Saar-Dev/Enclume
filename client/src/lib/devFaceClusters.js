// ─── devFaceClusters.js ────────────────────────────────────────────────────────
// Outil dev uniquement (DiceCalibrationPage.jsx) — port navigateur de
// tools/inspect-glb.js : k-means sur les normales géométriques des triangles
// d'un THREE.BufferGeometry déjà chargé. Permet de calibrer/vérifier n'importe
// quel dé sans transcrire des vecteurs à la main (source d'erreurs).

function triangleNormal(p0, p1, p2) {
  const e1x = p1[0] - p0[0], e1y = p1[1] - p0[1], e1z = p1[2] - p0[2]
  const e2x = p2[0] - p0[0], e2y = p2[1] - p0[1], e2z = p2[2] - p0[2]
  const nx = e1y * e2z - e1z * e2y
  const ny = e1z * e2x - e1x * e2z
  const nz = e1x * e2y - e1y * e2x
  const l = Math.hypot(nx, ny, nz)
  return l > 1e-10 ? [nx / l, ny / l, nz / l] : [0, 1, 0]
}

function runKmeans(points, k, seed) {
  let s = seed | 1
  const rand = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0xFFFFFFFF }

  const centers = [points[Math.floor(rand() * points.length)].slice()]
  for (let c = 1; c < k; c++) {
    const dists = points.map(p => {
      let maxDot = -1
      for (const ctr of centers) {
        const d = p[0] * ctr[0] + p[1] * ctr[1] + p[2] * ctr[2]
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
        const d = p[0] * centers[c][0] + p[1] * centers[c][1] + p[2] * centers[c][2]
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
      const l = Math.hypot(cx, cy, cz)
      centers[c] = [cx / l, cy / l, cz / l]
    }
  }

  let score = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i], c = centers[assign[i]]
    score += p[0] * c[0] + p[1] * c[1] + p[2] * c[2]
  }
  return { centers, assign, score }
}

// geometry : THREE.BufferGeometry (indexée ou non) — k : nombre de faces attendu.
// Retourne [{ normal:[x,y,z], triCount }] trié par nombre de triangles décroissant.
export function computeFaceClusters(geometry, k) {
  const pos = geometry.attributes.position
  const idx = geometry.index
  const triCount = idx ? idx.count / 3 : pos.count / 3

  const triNormals = []
  for (let i = 0; i < triCount; i++) {
    const i0 = idx ? idx.getX(i * 3) : i * 3
    const i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1
    const i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2
    triNormals.push(triangleNormal(
      [pos.getX(i0), pos.getY(i0), pos.getZ(i0)],
      [pos.getX(i1), pos.getY(i1), pos.getZ(i1)],
      [pos.getX(i2), pos.getY(i2), pos.getZ(i2)],
    ))
  }

  let best = null
  for (let s = 0; s < 12; s++) {
    const r = runKmeans(triNormals, k, s * 31337)
    if (!best || r.score > best.score) best = r
  }

  const counts = new Array(k).fill(0)
  for (const a of best.assign) counts[a]++

  return best.centers
    .map((c, i) => ({ normal: c, triCount: counts[i] }))
    .sort((a, b) => b.triCount - a.triCount)
}
