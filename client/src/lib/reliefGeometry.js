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
  profile,
  displace,
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
  const startIndex = indices.length
  const baseIndex = positions.length / 3

  for (let v = 0; v <= segV; v += 1) {
    const vr = v / segV
    for (let u = 0; u <= segU; u += 1) {
      const ur = u / segU
      const x = def.origin[0] + def.uAxis[0] * ur + def.vAxis[0] * vr
      const y = def.origin[1] + def.uAxis[1] * ur + def.vAxis[1] * vr
      const z = def.origin[2] + def.uAxis[2] * ur + def.vAxis[2] * vr
      const uvU = ur * Math.max(1, def.uSize)
      const uvV = vr * Math.max(1, def.vSize)
      const rawDisplacement = displace ? displacementFor(profile, uvU, uvV) : 0
      const displacement = rawDisplacement > 0 ? rawDisplacement * edgeFade(ur, vr) : rawDisplacement
      pushVertex(positions, def.normal, x, y, z, displacement)
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
      profile,
      displace,
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

function getVec3(array, index) {
  const offset = index * 3
  return [array[offset], array[offset + 1], array[offset + 2]]
}

function getVec2(array, index) {
  const offset = index * 2
  return [array[offset], array[offset + 1]]
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function len(v) {
  return Math.hypot(v[0], v[1], v[2])
}

function addSubdividedQuad({
  outPositions,
  outUvs,
  outIndices,
  a,
  b,
  c,
  normal,
  uvA,
  uvB,
  uvC,
  profile,
  segmentsPerUnit,
  maxSegments,
}) {
  const axisU = sub(b, a)
  const axisV = sub(c, a)
  const uvU = [uvB[0] - uvA[0], uvB[1] - uvA[1]]
  const uvV = [uvC[0] - uvA[0], uvC[1] - uvA[1]]
  const segU = clamp(Math.ceil(len(axisU) * segmentsPerUnit), 2, maxSegments)
  const segV = clamp(Math.ceil(len(axisV) * segmentsPerUnit), 2, maxSegments)
  const baseIndex = outPositions.length / 3

  for (let v = 0; v <= segV; v += 1) {
    const vr = v / segV
    for (let u = 0; u <= segU; u += 1) {
      const ur = u / segU
      const uCoord = uvA[0] + uvU[0] * ur + uvV[0] * vr
      const vCoord = uvA[1] + uvU[1] * ur + uvV[1] * vr
      const displacement = displacementFor(profile, uCoord, vCoord) * edgeFade(ur, vr)
      pushVertex(
        outPositions,
        normal,
        a[0] + axisU[0] * ur + axisV[0] * vr,
        a[1] + axisU[1] * ur + axisV[1] * vr,
        a[2] + axisU[2] * ur + axisV[2] * vr,
        displacement,
      )
      outUvs.push(uCoord, vCoord)
    }
  }

  for (let v = 0; v < segV; v += 1) {
    for (let u = 0; u < segU; u += 1) {
      const i = baseIndex + v * (segU + 1) + u
      const right = i + 1
      const up = i + segU + 1
      const diagonal = up + 1
      outIndices.push(i, right, up, up, right, diagonal)
    }
  }
}

export function createReliefGeometryFromQuadData({
  positions,
  normals,
  uvs,
  indices,
  profile,
  segmentsPerUnit = 12,
  maxSegments = 32,
}) {
  if (!isRealReliefProfile(profile)) return null

  const outPositions = []
  const outUvs = []
  const outIndices = []

  for (let i = 0; i < indices.length; i += 6) {
    const ia = indices[i]
    const ib = indices[i + 1]
    const ic = indices[i + 2]
    addSubdividedQuad({
      outPositions,
      outUvs,
      outIndices,
      a: getVec3(positions, ia),
      b: getVec3(positions, ib),
      c: getVec3(positions, ic),
      normal: getVec3(normals, ia),
      uvA: getVec2(uvs, ia),
      uvB: getVec2(uvs, ib),
      uvC: getVec2(uvs, ic),
      profile,
      segmentsPerUnit,
      maxSegments,
    })
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outPositions), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(outUvs), 2))
  geometry.setIndex(outIndices)
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
