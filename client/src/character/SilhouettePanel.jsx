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

      if (!here.length) {
        result[loc] = null
        continue
      }

      const worstIdx = Math.max(
        ...here.map(w => WOUND_SEVERITIES.indexOf(w.severity))
      )

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
      <svg
        viewBox="0 0 300 460"
        xmlns="http://www.w3.org/2000/svg"
        style={s.svg}
      >

        {/* HEAD */}
                <path
          id={LOCATION_TO_SVG.tete}
          fill={fillFor('tete')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M150 24 Q170 24 176 42 L174 78 Q170 96 150 104 Q130 96 126 78 L124 42 Q130 24 150 24 Z"
        />

        <path
          id={LOCATION_TO_SVG.corps}
          fill={fillFor('corps')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M124 120 Q136 108 148 108 L152 108 Q164 108 176 120 L184 214 Q182 240 168 260 L132 260 Q118 240 116 214 Z"
        />

        <path
          id={LOCATION_TO_SVG['bras_gauche']}
          fill={fillFor('bras_gauche')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M76 132 Q86 120 96 124 L108 144 L100 246 L84 258 L68 242 L60 150 Z"
        />

        <path
          id={LOCATION_TO_SVG['bras_droit']}
          fill={fillFor('bras_droit')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M224 132 Q214 120 204 124 L192 144 L200 246 L216 258 L232 242 L240 150 Z"
        />

        <path
          id={LOCATION_TO_SVG['jambe_gauche']}
          fill={fillFor('jambe_gauche')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M120 280 L138 280 L144 388 L136 420 L114 420 L102 392 L106 306 Z"
        />

        <path
          id={LOCATION_TO_SVG['jambe_droite']}
          fill={fillFor('jambe_droite')}
          stroke={DEFAULT_STROKE}
          strokeWidth="1"
          d="M162 280 L180 280 L194 306 L198 392 L186 420 L164 420 L156 388 Z"
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