// SilhouetteSvg.jsx — primitif générique de rendu SVG à zones (région → path)
//
// Extrait de BodySilhouetteSvg.jsx (2026-09-15) pour permettre un second jeu de données (exo-armure,
// ExoSilhouettePanel.jsx) sans dupliquer la boucle de rendu ni toucher au préréglage humain existant
// (BodySilhouetteSvg.jsx devient un wrapper autour de ce primitif, API externe inchangée). Patron
// données région→path + callback couleur, comme les libs de silhouette anatomique (ex.
// react-body-highlighter) — pas un pattern inventé.
export default function SilhouetteSvg({ paths, viewBox, fillFor, strokeFor, idFor, onClickLocation, onHoverLocation, style }) {
  const locations = Object.keys(paths)
  const resolveId = idFor || ((loc) => loc)

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', ...style }}
    >
      {locations.map(loc => (
        <path
          key={loc}
          id={resolveId(loc)}
          fill={fillFor(loc)}
          stroke={strokeFor ? strokeFor(loc) : '#4a4a7a'}
          strokeWidth="1"
          d={paths[loc]}
          onClick={onClickLocation ? () => onClickLocation(loc) : undefined}
          onMouseEnter={onHoverLocation ? () => onHoverLocation(loc) : undefined}
          onMouseLeave={onHoverLocation ? () => onHoverLocation(null) : undefined}
          style={onClickLocation ? { cursor: 'pointer' } : undefined}
        />
      ))}
    </svg>
  )
}
