import raycastVoxels from 'fast-voxel-raycast'

// checkLOS — vérifie si la ligne de vue est dégagée entre deux tokens.
// voxels    : { "x:y:z": voxelObj } — voxelsRef.current de Scene / battlemaps.voxel_data JSONB
// fromToken, toToken : objets token DB (pos_x / pos_y=Zthree / pos_z=Ythree)
// Retourne  : { clear: boolean, dist: number }
export function checkLOS(voxels, fromToken, toToken) {
  // PE14 — pos_x=X, pos_y=Z Three.js (profondeur), pos_z=Y Three.js (altitude)
  // Eye height = pos_z + 2.5 : pieds à pos_z+1.0 (surface voxel) + 1.5 (mi-torse token 2-cases)
  const fx = fromToken.pos_x + 0.5,  fy = fromToken.pos_z + 2.5,  fz = fromToken.pos_y + 0.5
  const tx = toToken.pos_x  + 0.5,   ty = toToken.pos_z  + 2.5,   tz = toToken.pos_y  + 0.5
  const dx = tx - fx, dy = ty - fy, dz = tz - fz
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dist < 0.001) return { clear: true, dist: 0 }
  const dir = [dx / dist, dy / dist, dz / dist]
  // dist - 0.3 : marge avant la cible, évite de détecter le voxel "pied de la cible"
  const hit = raycastVoxels((x, y, z) => !!voxels[`${x}:${y}:${z}`], [fx, fy, fz], dir, dist - 0.3)
  return { clear: !hit, dist }
}

// SURFACE — offset voxel→pieds du token (surface voxel = pos_z + 1.0)
const SURFACE = 1.0

// POSTURE_RAYS — hauteurs anatomiques au-dessus des pieds, par posture
// Phase 2 : ajouter 'accroupi' et 'couche' quand tokens.posture implémenté
const POSTURE_RAYS = {
  debout: [1.80, 1.30, 0.80, 0.30],  // tête / torse haut / ventre / genoux
}

// checkCoverage — 4 rayons verticaux src→zones cible, retourne modifier Polaris (-3/-5/0)
// voxels : { "x:y:z": voxelObj } — même format que checkLOS
export function checkCoverage(voxels, srcToken, tgtToken) {
  const offsets = POSTURE_RAYS['debout']  // Phase 2 : POSTURE_RAYS[tgtToken.posture ?? 'debout']
  const fx = srcToken.pos_x + 0.5, fy = srcToken.pos_z + 2.5, fz = srcToken.pos_y + 0.5
  let blocked = 0
  const labels = ['tete', 'torse-H', 'ventre', 'genoux']
  for (let i = 0; i < offsets.length; i++) {
    const feetOffset = offsets[i]
    const tx = tgtToken.pos_x + 0.5
    const ty = tgtToken.pos_z + SURFACE + feetOffset  // PE14 : pos_z + surface + hauteur anatomique
    const tz = tgtToken.pos_y + 0.5
    const dx = tx - fx, dy = ty - fy, dz = tz - fz
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist < 0.001) continue
    const dir = [dx / dist, dy / dist, dz / dist]
    const hit = raycastVoxels((x, y, z) => !!voxels[`${x}:${y}:${z}`], [fx, fy, fz], dir, dist - 0.3)
    console.log(`[DBG-COV] R${i + 1}(${labels[i]}) src:(${fx.toFixed(1)},${fy.toFixed(1)},${fz.toFixed(1)}) → tgt:(${tx.toFixed(1)},${ty.toFixed(1)},${tz.toFixed(1)}) dist:${dist.toFixed(2)} → ${hit ? 'BLOQUÉ' : 'clear'}`)
    if (hit) blocked++
  }
  const pct = blocked / offsets.length
  return { blocked, total: offsets.length, modifier: pct >= 0.75 ? -5 : pct >= 0.50 ? -3 : 0 }
}

// findInterceptingTokens — retourne les tokens sur le rayon src→tgt (excl. src et tgt),
// triés par distance croissante. Utilisé pour détecter les cibles interposées.
export function findInterceptingTokens(voxels, allTokens, srcToken, tgtToken) {
  const fx = srcToken.pos_x + 0.5, fy = srcToken.pos_z + 2.5, fz = srcToken.pos_y + 0.5
  const tx = tgtToken.pos_x + 0.5, ty = tgtToken.pos_z + 2.5, tz = tgtToken.pos_y + 0.5
  const dx = tx - fx, dy = ty - fy, dz = tz - fz
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dist < 0.001) return []
  const dir = [dx / dist, dy / dist, dz / dist]
  const result = []
  for (const t of allTokens) {
    if (t.id === srcToken.id || t.id === tgtToken.id) continue
    const vx = t.pos_x + 0.5 - fx, vy = t.pos_z + 2.5 - fy, vz = t.pos_y + 0.5 - fz
    const proj = vx * dir[0] + vy * dir[1] + vz * dir[2]
    if (proj < 0.5 || proj > dist - 0.5) continue
    const perpSq = (vx - proj * dir[0]) ** 2 + (vy - proj * dir[1]) ** 2 + (vz - proj * dir[2]) ** 2
    if (perpSq < 0.75 ** 2) result.push({ token: t, dist: proj })
  }
  return result.sort((a, b) => a.dist - b.dist)
}
