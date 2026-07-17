import { LOCATION_TO_SVG } from '../../../shared/armorConstants.js'

// Géométrie extraite de SilhouettePanel.jsx (fiche perso, onglet MATERIEL) — seule autorité du
// tracé du corps, partagée entre l'affichage lecture-seule des blessures (SilhouettePanel.jsx) et
// tout picker interactif (ex. Viser une Localisation précise, docs/PLAN_TIRVISE v2.md).
const PATHS = {
  tete:         'M150 24 Q170 24 176 42 L174 78 Q170 96 150 104 Q130 96 126 78 L124 42 Q130 24 150 24 Z',
  corps:        'M124 120 Q136 108 148 108 L152 108 Q164 108 176 120 L184 214 Q182 240 168 260 L132 260 Q118 240 116 214 Z',
  bras_gauche:  'M76 132 Q86 120 96 124 L108 144 L100 246 L84 258 L68 242 L60 150 Z',
  bras_droit:   'M224 132 Q214 120 204 124 L192 144 L200 246 L216 258 L232 242 L240 150 Z',
  jambe_gauche: 'M120 280 L138 280 L144 388 L136 420 L114 420 L102 392 L106 306 Z',
  jambe_droite: 'M162 280 L180 280 L194 306 L198 392 L186 420 L164 420 L156 388 Z',
}

const LOCATIONS = Object.keys(PATHS)
const DEFAULT_STROKE = '#4a4a7a'

export default function BodySilhouetteSvg({ fillFor, strokeFor, onClickLocation, onHoverLocation, style }) {
  return (
    <svg
      viewBox="0 0 300 460"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', ...style }}
    >
      {LOCATIONS.map(loc => (
        <path
          key={loc}
          id={LOCATION_TO_SVG[loc]}
          fill={fillFor(loc)}
          stroke={strokeFor ? strokeFor(loc) : DEFAULT_STROKE}
          strokeWidth="1"
          d={PATHS[loc]}
          onClick={onClickLocation ? () => onClickLocation(loc) : undefined}
          onMouseEnter={onHoverLocation ? () => onHoverLocation(loc) : undefined}
          onMouseLeave={onHoverLocation ? () => onHoverLocation(null) : undefined}
          style={onClickLocation ? { cursor: 'pointer' } : undefined}
        />
      ))}
    </svg>
  )
}
