// ─── GeometryIcon — icônes SVG inline par type de géométrie voxel ────────────
// Vue isométrique schématique, trait sur fond transparent, currentColor.
// Usage : aperçu dans la palette blocs, lisible à 14×14px.
//
// Props :
//   geometry : 'cube' | 'slab_bottom' | 'slab_top' | 'slope' | 'wedge'
//   size     : taille en px (défaut 14)
//   style    : styles supplémentaires (ex: position absolute)

export default function GeometryIcon({ geometry, size = 14, style }) {
  const s = size
  const icons = {
    cube: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M7 1L13 4.5V10.5L7 14L1 10.5V4.5L7 1Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M7 1V14M1 4.5L13 4.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
    slab_bottom: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M7 8L13 11V14L7 14L1 14V11L7 8Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M1 11L13 11" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
    slab_top: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M7 1L13 4.5V7L7 7L1 7V4.5L7 1Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M1 4.5L13 4.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
    slope: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M1 14L13 4.5V14L1 14Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M1 14L13 4.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
    wedge: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M1 14L7 1L13 14L1 14Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
      </svg>
    ),
  }
  return icons[geometry] ?? null
}
