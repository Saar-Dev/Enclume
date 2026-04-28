import * as THREE from 'three'

// ─── Cache textures module-level ─────────────────────────────────────────────
// Partagé entre Canvas3D et Editor3D — pas d'invalidation en V1 (limitation connue).
export const textureCache = {}

// ─── Chargement des textures par IDs de voxel_textures ───────────────────────
// Charge les textures pour un tableau de voxel_textures retourné par /api/voxel-textures.
// Retourne textureMaterials : { [texId]: { faceMaterials: THREE.MeshLambertMaterial[] } }
//
// Ordre faces BoxGeometry Three.js — P32 :
//   0 = east  (+X)   1 = west  (-X)
//   2 = top   (+Y)   3 = bottom(-Y)
//   4 = south (+Z)   5 = north (-Z)
//
// Priorité par face : face spécifique > all > magenta (MeshLambertMaterial 0xFF00FF).
// makeMat retourne toujours MeshLambertMaterial — type homogène requis pour le spread JSX.
export async function loadVoxelTextures(textures) {
  const loader = new THREE.TextureLoader()
  const result = {}

  for (const tex of textures) {
    const faces = tex.faces  // { top?, bottom?, north?, south?, east?, west?, all? }
    const packId = tex.pack_id

    // Résoudre alias 'side' → faces nommées (rétrocompat seed V1 — P33)
    // 'side' est un alias lecture uniquement : north + south + east + west.
    // La migration 29 a déjà converti en base, mais on gère ici pour les imports ZIP legacy.
    const resolved = { ...faces }
    if (faces.side) {
      if (!resolved.north) resolved.north = faces.side
      if (!resolved.south) resolved.south = faces.side
      if (!resolved.east)  resolved.east  = faces.side
      if (!resolved.west)  resolved.west  = faces.side
      delete resolved.side
    }

    const loadTex = (path) => {
      if (!path) return Promise.resolve(null)
      const url = `${import.meta.env.VITE_API_URL}/api/textures/${packId}/${path}`
      if (textureCache[url]) return Promise.resolve(textureCache[url])
      return new Promise((resolve) => {
        loader.load(url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.magFilter = THREE.NearestFilter
          t.minFilter = THREE.NearestFilter
          textureCache[url] = t
          resolve(t)
        }, undefined, () => {
          console.warn(`[voxelTextures] Texture manquante : ${packId}/${path}`)
          resolve(null)
        })
      })
    }

    // makeMat retourne toujours MeshLambertMaterial :
    // - avec texture : map + color white
    // - sans texture : color magenta (debug visuel)
    const makeMat = (t) => {
      if (t) return new THREE.MeshLambertMaterial({ map: t, color: 0xffffff })
      console.warn(`[voxelTextures] Texture ${tex.id} (${tex.label}) — face sans texture → magenta`)
      return new THREE.MeshLambertMaterial({ color: 0xFF00FF })
    }

    // Charger les 6 faces dans l'ordre P32 : east, west, top, bottom, south, north
    const eastTex   = await loadTex(resolved.east   || resolved.all || null)
    const westTex   = await loadTex(resolved.west   || resolved.all || null)
    const topTex    = await loadTex(resolved.top    || resolved.all || null)
    const bottomTex = await loadTex(resolved.bottom || resolved.all || null)
    const southTex  = await loadTex(resolved.south  || resolved.all || null)
    const northTex  = await loadTex(resolved.north  || resolved.all || null)

    result[tex.id] = {
      faceMaterials: [
        makeMat(eastTex),
        makeMat(westTex),
        makeMat(topTex),
        makeMat(bottomTex),
        makeMat(southTex),
        makeMat(northTex),
      ],
    }
  }

  return result
}