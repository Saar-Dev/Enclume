import * as THREE from 'three'
import { proceduralPatternUsesCutout } from './proceduralMaterials.js'

// Cache module-level, shared by Canvas3D, Editor3D and workshop previews.
export const textureCache = {}

const FACE_ORDER = ['east', 'west', 'top', 'bottom', 'south', 'north']

function resolveLegacyFaces(faces) {
  const resolved = { ...(faces || {}) }
  if (resolved.side) {
    if (!resolved.north) resolved.north = resolved.side
    if (!resolved.south) resolved.south = resolved.side
    if (!resolved.east) resolved.east = resolved.side
    if (!resolved.west) resolved.west = resolved.side
    delete resolved.side
  }
  return resolved
}

function texturePathForFace(faces, faceName) {
  return faces[faceName] || faces.all || null
}

function normalPathForFace(faces, faceName) {
  return faces[`${faceName}_normal`] || faces.all_normal || null
}

function proceduralReliefForFaces(faces) {
  const meta = faces.__procedural || faces.procedural || null
  if (!meta || typeof meta !== 'object') return null
  if (meta.type !== 'procedural-material') return null
  return meta
}

// Charge les textures pour un tableau de voxel_textures retourne par /api/voxel-textures.
// Retourne : { [texId]: { faceMaterials: THREE.MeshStandardMaterial[] } }
//
// Ordre faces BoxGeometry Three.js :
//   0 = east  (+X)   1 = west  (-X)
//   2 = top   (+Y)   3 = bottom(-Y)
//   4 = south (+Z)   5 = north (-Z)
//
// Normal maps optionnelles : <face>_normal > all_normal.
export async function loadVoxelTextures(textures) {
  const loader = new THREE.TextureLoader()
  const result = {}

  for (const tex of textures) {
    const faces = resolveLegacyFaces(tex.faces)
    const packId = tex.pack_id
    const procedural = proceduralReliefForFaces(faces)
    const cutout = proceduralPatternUsesCutout(procedural?.pattern)

    const loadTex = (path, { color = true } = {}) => {
      if (!path) return Promise.resolve(null)
      const url = `${import.meta.env.VITE_API_URL}/api/textures/${packId}/${path}`
      const cacheKey = `${url}|${color ? 'color' : 'data'}`
      if (textureCache[cacheKey]) return Promise.resolve(textureCache[cacheKey])

      return new Promise((resolve) => {
        loader.load(url, (texture) => {
          texture.colorSpace = color ? THREE.SRGBColorSpace : (THREE.NoColorSpace || '')
          texture.magFilter = THREE.NearestFilter
          texture.minFilter = THREE.NearestFilter
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
          textureCache[cacheKey] = texture
          resolve(texture)
        }, undefined, () => {
          console.warn(`[voxelTextures] Texture manquante : ${packId}/${path}`)
          resolve(null)
        })
      })
    }

    const makeMat = (map, normalMap) => {
      if (map) {
        return new THREE.MeshStandardMaterial({
          map,
          normalMap: normalMap || null,
          normalScale: new THREE.Vector2(0.75, 0.75),
          color: 0xffffff,
          roughness: cutout ? 0.48 : 0.72,
          metalness: cutout ? 0.72 : 0.08,
          alphaTest: cutout ? Number(procedural?.alphaCutoff) || 0.5 : 0,
          side: cutout ? THREE.DoubleSide : THREE.FrontSide,
        })
      }

      console.warn(`[voxelTextures] Texture ${tex.id} (${tex.label}) : face sans texture -> magenta`)
      return new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.8 })
    }

    const loadedFaces = await Promise.all(FACE_ORDER.map(async (faceName) => {
      const map = await loadTex(texturePathForFace(faces, faceName))
      const normalMap = await loadTex(normalPathForFace(faces, faceName), { color: false })
      return makeMat(map, normalMap)
    }))

    result[tex.id] = {
      faceMaterials: loadedFaces,
      relief: cutout ? null : procedural,
      cutout,
      solidMaterial: cutout
        ? new THREE.MeshStandardMaterial({
            color: procedural?.paint || '#6f7f8e',
            roughness: 0.5,
            metalness: 0.68,
          })
        : null,
    }
  }

  return result
}
