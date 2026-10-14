import * as THREE from 'three'
import { sampleProceduralMaterialHeight } from './proceduralMaterials.js'

export const BOX_FACE_COUNT = 6
export const DEFAULT_RELIEF_SCALE = 0.22

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function isRealReliefProfile(profile) {
  return !!profile
    && profile.type === 'procedural-material'
    && profile.realRelief !== false
    && Number(profile.relief) > 0
}

export function hasRealRelief(faceProfiles, faceMask = null) {
  if (!faceProfiles) return false
  for (let i = 0; i < BOX_FACE_COUNT; i += 1) {
    if (faceMask && !faceMask[i]) continue
    if (isRealReliefProfile(faceProfiles[i])) return true
  }
  return false
}

export function normalizeFaceProfiles(profileOrProfiles) {
  if (!profileOrProfiles) return null
  if (Array.isArray(profileOrProfiles)) {
    return Array.from({ length: BOX_FACE_COUNT }, (_, i) => profileOrProfiles[i] || null)
  }
  return Array.from({ length: BOX_FACE_COUNT }, () => profileOrProfiles)
}

export function reliefProfileKey(faceProfiles, faceMask = null) {
  if (!faceProfiles) return 'none'
  return JSON.stringify({
    mask: faceMask || null,
    profiles: faceProfiles.map(profile => profile ? {
      type: profile.type,
      version: profile.version,
      material: profile.material,
      paint: profile.paint,
      pattern: profile.pattern,
      wear: profile.wear,
      dirt: profile.dirt,
      relief: profile.relief,
      realRelief: profile.realRelief,
      seed: profile.seed,
    } : null),
  })
}

function safeUvScale(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  if (Math.abs(n) < 0.05) return n < 0 ? -0.05 : 0.05
  return n
}

function normalizeUvScale(value) {
  if (!Array.isArray(value)) return null
  return [safeUvScale(value[0]), safeUvScale(value[1])]
}

function safeUvOffset(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeUvOffset(value) {
  if (!Array.isArray(value)) return null
  return [safeUvOffset(value[0]), safeUvOffset(value[1])]
}

export function normalizeFaceUvScales(faceUvScales) {
  const shared = normalizeUvScale(faceUvScales)
  if (shared) return Array.from({ length: BOX_FACE_COUNT }, () => shared)
  if (!Array.isArray(faceUvScales)) return null
  return Array.from({ length: BOX_FACE_COUNT }, (_, index) => normalizeUvScale(faceUvScales[index]))
}

export function normalizeFaceUvOffsets(faceUvOffsets) {
  const shared = normalizeUvOffset(faceUvOffsets)
  if (shared) return Array.from({ length: BOX_FACE_COUNT }, () => shared)
  if (!Array.isArray(faceUvOffsets)) return null
  return Array.from({ length: BOX_FACE_COUNT }, (_, index) => normalizeUvOffset(faceUvOffsets[index]))
}

export function reliefUvScaleKey(faceUvScales) {
  const normalized = normalizeFaceUvScales(faceUvScales)
  if (!normalized) return 'default'
  return JSON.stringify(normalized)
}

export function reliefUvOffsetKey(faceUvOffsets) {
  const normalized = normalizeFaceUvOffsets(faceUvOffsets)
  if (!normalized) return 'default'
  return JSON.stringify(normalized.map(offset => offset
    ? offset.map(value => Math.round(value * 1000) / 1000)
    : null))
}

function displacementFor(profile, u, v, scale = DEFAULT_RELIEF_SCALE) {
  if (!isRealReliefProfile(profile)) return 0
  const height = sampleProceduralMaterialHeight(u, v, profile)
  return clamp((height - 0.5) * scale, -0.12, 0.12)
}

function edgeFade(ur, vr) {
  const edge = Math.min(ur, 1 - ur, vr, 1 - vr)
  return clamp(edge * 10, 0, 1)
}

function pushVertex(positions, normal, x, y, z, displacement) {
  positions.push(
    x + normal[0] * displacement,
    y + normal[1] * displacement,
    z + normal[2] * displacement,
  )
}

function addReliefFace({
  positions,
  uvs,
  indices,
  groups,
  materialIndex,
  width,
  height,
  depth,
  face,
  displace,
  uvScale,
  segmentsPerUnit,
  maxSegments,
}) {
  const halfW = width / 2
  const halfH = height / 2
  const halfD = depth / 2
  const defs = [
    {
      origin: [halfW, -halfH, halfD],
      uAxis: [0, 0, -depth],
      vAxis: [0, height, 0],
      normal: [1, 0, 0],
      uSize: depth,
      vSize: height,
    },
    {
      origin: [-halfW, -halfH, -halfD],
      uAxis: [0, 0, depth],
      vAxis: [0, height, 0],
      normal: [-1, 0, 0],
      uSize: depth,
      vSize: height,
    },
    {
      origin: [-halfW, halfH, halfD],
      uAxis: [width, 0, 0],
      vAxis: [0, 0, -depth],
      normal: [0, 1, 0],
      uSize: width,
      vSize: depth,
    },
    {
      origin: [-halfW, -halfH, -halfD],
      uAxis: [width, 0, 0],
      vAxis: [0, 0, depth],
      normal: [0, -1, 0],
      uSize: width,
      vSize: depth,
    },
    {
      origin: [-halfW, -halfH, halfD],
      uAxis: [width, 0, 0],
      vAxis: [0, height, 0],
      normal: [0, 0, 1],
      uSize: width,
      vSize: height,
    },
    {
      origin: [halfW, -halfH, -halfD],
      uAxis: [-width, 0, 0],
      vAxis: [0, height, 0],
      normal: [0, 0, -1],
      uSize: width,
      vSize: height,
    },
  ]

  const def = defs[face]
  const segU = displace
    ? clamp(Math.ceil(def.uSize * segmentsPerUnit), 2, maxSegments)
    : 1
  const segV = displace
    ? clamp(Math.ceil(def.vSize * segmentsPerUnit), 2, maxSegments)
    : 1
  const explicitUvScale = normalizeUvScale(uvScale)
  const startIndex = indices.length
  const baseIndex = positions.length / 3

  // Le relief est porte par le GPU (displacementMap du materiau, voir proceduralMaterialAt()
  // dans SurfaceDungeonScene.jsx) depuis le chantier perf motifs (Saar, 2026-10-03) — cette face
  // reste subdivisee quand `displace` est vrai (pour donner des sommets au vertex shader) mais ne
  // calcule plus aucun bruit elle-meme ; `displacementFor`/`sampleProceduralMaterialHeight` restent
  // utilises par applyProceduralReliefToGeometry (sans appelant actuel, hors perimetre de ce
  // chantier). Le chemin voxel (createReliefGeometryFromQuadData) a ete retire — PLAN_PURGE_VOXEL.md
  // Lot 3/6 : plus aucun appelant depuis la suppression de CulledVoxelScene/DungeonTerrainScene.
  for (let v = 0; v <= segV; v += 1) {
    const vr = v / segV
    for (let u = 0; u <= segU; u += 1) {
      const ur = u / segU
      const x = def.origin[0] + def.uAxis[0] * ur + def.vAxis[0] * vr
      const y = def.origin[1] + def.uAxis[1] * ur + def.vAxis[1] * vr
      const z = def.origin[2] + def.uAxis[2] * ur + def.vAxis[2] * vr
      const uvU = explicitUvScale ? ur : ur * Math.max(1, def.uSize)
      const uvV = explicitUvScale ? vr : vr * Math.max(1, def.vSize)
      pushVertex(positions, def.normal, x, y, z, 0)
      uvs.push(uvU, uvV)
    }
  }

  for (let v = 0; v < segV; v += 1) {
    for (let u = 0; u < segU; u += 1) {
      const a = baseIndex + v * (segU + 1) + u
      const b = a + 1
      const c = a + segU + 1
      const d = c + 1
      indices.push(a, b, c, c, b, d)
    }
  }

  groups.push({
    start: startIndex,
    count: indices.length - startIndex,
    materialIndex,
  })
}

export function createReliefBoxGeometry({
  width = 1,
  height = 1,
  depth = 1,
  faceProfiles,
  faceMask = null,
  faceUvScales = null,
  faceUvOffsets = null,
  segmentsPerUnit = 12,
  maxSegments = 32,
} = {}) {
  const profiles = normalizeFaceProfiles(faceProfiles)
  if (!hasRealRelief(profiles, faceMask)) {
    return new THREE.BoxGeometry(width, height, depth)
  }

  const positions = []
  const uvs = []
  const indices = []
  const groups = []
  const uvScales = normalizeFaceUvScales(faceUvScales)
  const uvOffsets = normalizeFaceUvOffsets(faceUvOffsets)

  for (let face = 0; face < BOX_FACE_COUNT; face += 1) {
    const profile = profiles?.[face] || null
    const displace = (!faceMask || !!faceMask[face]) && isRealReliefProfile(profile)
    addReliefFace({
      positions,
      uvs,
      indices,
      groups,
      materialIndex: face,
      width,
      height,
      depth,
      face,
      displace,
      uvScale: uvScales?.[face] || null,
      // `uvOffset` ne sert plus qu'a la cle de cache de geometrie (ReliefBoxGeometry.jsx) depuis que
      // le relief est porte par le GPU — jamais utilise par addReliefFace, laisse ici pour ne pas
      // toucher a `uvOffsets`/la cle de cache, hors perimetre du chantier perf motifs.
      uvOffset: uvOffsets?.[face] || null,
      segmentsPerUnit,
      maxSegments,
    })
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.clearGroups()
  for (const group of groups) {
    geometry.addGroup(group.start, group.count, group.materialIndex)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function applyProceduralReliefToGeometry(geometry, profile, scale = DEFAULT_RELIEF_SCALE) {
  if (!geometry || !isRealReliefProfile(profile)) return geometry

  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  if (!position || !normal || !uv) return geometry

  for (let i = 0; i < position.count; i += 1) {
    const rawU = uv.getX(i)
    const rawV = uv.getY(i)
    const localU = ((rawU % 1) + 1) % 1
    const localV = ((rawV % 1) + 1) % 1
    const displacement = displacementFor(profile, rawU, rawV, scale) * edgeFade(localU, localV)
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * displacement,
      position.getY(i) + normal.getY(i) * displacement,
      position.getZ(i) + normal.getZ(i) * displacement,
    )
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
