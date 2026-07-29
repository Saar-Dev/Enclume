// docs/PLAN_BATTLEMAP2D.md §10 (Lot 5) — fenêtre de cadrage d'un portrait (généralement non carré,
// ex. 200×260 dans CharacterWindow.jsx) dans une forme de token carrée en UV (cercle/hexagone/carré
// partagent tous une projection UV radiale centrée [0,1]², voir TokenPresentation.jsx).
// Calcul UNIQUE partagé entre le rendu réel (texture Three.js) et l'aperçu d'édition (CSS) — correctif
// suite au signalement de Saar : la première version (offset/repeat calculés indépendamment des deux
// côtés, sans correction de ratio d'aspect) neutralisait l'offset à zoom=1 et déformait l'image.
//
// `zoom=1` correspond à un cadrage "cover" — l'axe le plus long de l'image source est rogné pour
// remplir le carré, comme `object-fit: cover`. `offsetX`/`offsetY` (∈ [-50,50]) déplacent la fenêtre
// dans la marge disponible sur cet axe (nulle si l'image est déjà carrée sur cet axe à ce zoom).
export function tokenCropWindow({ naturalWidth, naturalHeight, offsetX = 0, offsetY = 0, zoom = 1 }) {
  const z = Math.max(1, zoom)
  const aspect = naturalWidth / naturalHeight
  const baseRepeatX = aspect > 1 ? 1 / aspect : 1
  const baseRepeatY = aspect > 1 ? 1 : aspect
  const repeatX = baseRepeatX / z
  const repeatY = baseRepeatY / z
  const panRangeX = 1 - repeatX
  const panRangeY = 1 - repeatY
  const centerU = 0.5 + (panRangeX > 0 ? (offsetX / 100) * panRangeX : 0)
  const centerV = 0.5 + (panRangeY > 0 ? (offsetY / 100) * panRangeY : 0)
  return {
    repeatX,
    repeatY,
    offsetU: centerU - repeatX / 2,
    offsetV: centerV - repeatY / 2,
  }
}

// Inverse de tokenCropWindow — reconstruit offsetX/offsetY (échelle de stockage [-50,50]) à partir
// d'un centre UV visé (utilisé par le glisser-déposer de l'éditeur, qui manipule des pixels d'écran,
// pas directement l'échelle de stockage). Clampé : hors marge disponible, l'offset reste à la borne.
export function tokenCropOffsetFromCenter({ naturalWidth, naturalHeight, centerU, centerV, zoom = 1 }) {
  const z = Math.max(1, zoom)
  const aspect = naturalWidth / naturalHeight
  const baseRepeatX = aspect > 1 ? 1 / aspect : 1
  const baseRepeatY = aspect > 1 ? 1 : aspect
  const panRangeX = 1 - baseRepeatX / z
  const panRangeY = 1 - baseRepeatY / z
  const offsetX = panRangeX > 0 ? ((centerU - 0.5) / panRangeX) * 100 : 0
  const offsetY = panRangeY > 0 ? ((centerV - 0.5) / panRangeY) * 100 : 0
  return {
    offsetX: Math.max(-50, Math.min(50, offsetX)),
    offsetY: Math.max(-50, Math.min(50, offsetY)),
  }
}
