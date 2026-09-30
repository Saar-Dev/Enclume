// Cache de height maps importées (PLAN_WORLD_BUILDER_REWORK.md §14, motifs). Décodées à la demande
// (jamais toutes au chargement de l'app — coûteux et inutile pour des motifs non utilisés par la
// carte ouverte), une seule fois par fichier, à une résolution fixe réduite plutôt que la résolution
// source (voir DECODE_SIZE).

// Tous les appelants actuels de generateProceduralMaterialTexture demandent 128px
// (SurfaceDungeonScene.jsx) ou une taille de pack configurable par défaut 128px
// (MaterialGeneratorTab.jsx, tile_size en base). 256 laisse une marge (jusqu'à un futur appelant à
// 256) sans re-décoder un fichier par taille demandée — un cache par taille serait plus précis mais
// résout un besoin que personne n'a exprimé (aucun appelant ne dépasse 256 aujourd'hui).
const DECODE_SIZE = 256

const cache = new Map()
const pending = new Map()
const listeners = new Map()

// createImageBitmap({resizeWidth/Height}) : décodage + redimensionnement déportés par le navigateur
// (hors fil principal sur la plupart des implémentations), contrairement à `new Image()` +
// `ctx.getImageData()` sur la résolution source qui bloque le fil principal — c'est cette lecture
// pleine résolution (512px × 36 fichiers) qui provoquait le gel au chargement.
async function decode(src) {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Displacement map introuvable : ${src}`)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: DECODE_SIZE,
    resizeHeight: DECODE_SIZE,
    resizeQuality: 'high',
  })
  const canvas = document.createElement('canvas')
  canvas.width = DECODE_SIZE
  canvas.height = DECODE_SIZE
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imageData = ctx.getImageData(0, 0, DECODE_SIZE, DECODE_SIZE)
  const raw = imageData.data
  const data = new Float32Array(DECODE_SIZE * DECODE_SIZE)
  for (let i = 0; i < data.length; i += 1) data[i] = raw[i * 4] / 255
  return { width: DECODE_SIZE, height: DECODE_SIZE, data }
}

export function isDisplacementMapReady(src) {
  return cache.has(src)
}

export function preloadDisplacementMap(src) {
  if (!src) return Promise.resolve(null)
  if (cache.has(src)) return Promise.resolve(cache.get(src))
  if (pending.has(src)) return pending.get(src)
  const promise = decode(src)
    .then(entry => {
      cache.set(src, entry)
      pending.delete(src)
      const subs = listeners.get(src)
      if (subs) {
        listeners.delete(src)
        subs.forEach(cb => { try { cb() } catch { /* écouteur défaillant, ne bloque pas les autres */ } } )
      }
      return entry
    })
    .catch(err => {
      pending.delete(src)
      if (typeof console !== 'undefined') console.warn(err.message)
      return null
    })
  pending.set(src, promise)
  return promise
}

// Notifie `callback` une fois (immédiatement si déjà prêt, sinon au chargement) — jamais répété,
// jamais après un échec de décodage (callback jamais appelé dans ce cas, le fallback neutre reste
// silencieusement en place plutôt que de boucler sur une source invalide). Retourne un désabonnement.
export function onDisplacementMapReady(src, callback) {
  if (!src) return () => {}
  if (cache.has(src)) {
    callback()
    return () => {}
  }
  if (!listeners.has(src)) listeners.set(src, new Set())
  listeners.get(src).add(callback)
  return () => listeners.get(src)?.delete(callback)
}

// 0..1, tuilé (wrap). Déclenche paresseusement le chargement au premier échantillonnage d'une
// source pas encore en cache (idempotent, voir `pending`) — renvoie 0.5 (relief neutre, plat) en
// attendant, jamais bloquant.
export function sampleDisplacementMap(src, u, v) {
  const entry = cache.get(src)
  if (!entry) {
    preloadDisplacementMap(src)
    return 0.5
  }
  const { width, height, data } = entry
  const wrappedU = ((u % 1) + 1) % 1
  const wrappedV = ((v % 1) + 1) % 1
  const px = Math.min(width - 1, Math.floor(wrappedU * width))
  const py = Math.min(height - 1, Math.floor(wrappedV * height))
  return data[py * width + px]
}
