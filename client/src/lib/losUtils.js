import raycastVoxels from 'fast-voxel-raycast'

// checkLOS — vérifie si la ligne de vue est dégagée entre deux tokens.
// voxels    : { "x:y:z": voxelObj } — voxelsRef.current de Scene
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
