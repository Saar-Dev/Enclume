import * as THREE from 'three'

// Cache module-level, partagé par Editor3D et Canvas3D — même patron que `textureCache`
// (surfaceTextures.js) : une image de décor donnée n'est jamais rechargée deux fois.
export const decalTextureCache = {}

// Charge le catalogue retourné par GET /decal-assets (Lot 0) en textures Three.js.
// Retourne : { [assetId]: { texture: THREE.Texture, ratio: number } }
export async function loadDecalAssets(assets) {
  const loader = new THREE.TextureLoader()

  const entries = await Promise.all((assets || []).map(async (asset) => {
    const url = asset?.url
    if (!url) return [asset?.id, null]
    if (decalTextureCache[url]) return [asset.id, decalTextureCache[url]]

    const texture = await new Promise((resolve) => {
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        resolve(tex)
      }, undefined, () => {
        console.warn(`[decalAssets] Image de décor manquante : ${url}`)
        resolve(null)
      })
    })
    if (!texture) return [asset.id, null]

    const entry = { texture, ratio: Number(asset.ratio) || 1 }
    decalTextureCache[url] = entry
    return [asset.id, entry]
  }))

  return Object.fromEntries(entries.filter(([id]) => id))
}
