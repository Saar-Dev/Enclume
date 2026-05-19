import { useMemo } from 'react'
import { WOUND_LOCATIONS, WOUND_SEVERITIES, SEVERITY_COLORS } from '../../../shared/woundConstants.js'
import { LOCATION_TO_SVG } from '../../../shared/armorConstants.js'

const DEFAULT_FILL = '#D9F7FF'
const DEFAULT_STROKE = '#4a4a7a'

export default function SilhouettePanel({ wounds }) {
  // Pour chaque wound location, trouver la sévérité la plus grave présente
  const worstByLocation = useMemo(() => {
    const result = {}
    for (const loc of WOUND_LOCATIONS) {
      const here = wounds.filter(w => w.location === loc)
      if (!here.length) { result[loc] = null; continue }
      const worstIdx = Math.max(...here.map(w => WOUND_SEVERITIES.indexOf(w.severity)))
      result[loc] = WOUND_SEVERITIES[worstIdx]
    }
    return result
  }, [wounds])

  const fillFor = (loc) => {
    const sev = worstByLocation[loc]
    return sev ? SEVERITY_COLORS[sev] : DEFAULT_FILL
  }

  return (
    <div style={s.wrapper}>
      <svg viewBox="0 0 300 460" xmlns="http://www.w3.org/2000/svg" style={s.svg}>
        <path
          id={LOCATION_TO_SVG.tete}
          fill={fillFor('tete')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M150 24 Q176 24 182 50 L178 84 Q150 106 122 84 L118 50 Q124 24 150 24 Z"
        />
        <path
          id={LOCATION_TO_SVG.corps}
          fill={fillFor('corps')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M120 118 Q150 96 180 118 L194 214 Q192 248 168 272 L132 272 Q108 248 106 214 Z"
        />
        <path
          id={LOCATION_TO_SVG['bras_gauche']}
          fill={fillFor('bras_gauche')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M58 126 L92 138 L84 258 L50 246 L42 154 Z"
        />
        <path
          id={LOCATION_TO_SVG['bras_droit']}
          fill={fillFor('bras_droit')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M208 138 L242 126 L258 154 L250 246 L216 258 Z"
        />
        <path
          id={LOCATION_TO_SVG['jambe_gauche']}
          fill={fillFor('jambe_gauche')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M102 282 L124 282 L128 390 L118 426 L88 426 L80 394 L86 314 Z"
        />
        <path
          id={LOCATION_TO_SVG['jambe_droite']}
          fill={fillFor('jambe_droite')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M176 282 L198 282 L214 314 L220 394 L212 426 L182 426 L172 390 Z"
        />
      </svg>
    </div>
  )
}

const s = {
  wrapper: {
    padding: '8px 0',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  svg: {
    width: '50%',
    height: 'auto',
    display: 'block',
  },
}
