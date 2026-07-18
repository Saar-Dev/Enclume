import { useMemo } from 'react'
import { WOUND_LOCATIONS, WOUND_SEVERITIES, SEVERITY_COLORS } from '../../../shared/woundConstants.js'
import BodySilhouetteSvg from '../components/BodySilhouetteSvg.jsx'

const DEFAULT_FILL = '#D9F7FF'

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
      <BodySilhouetteSvg fillFor={fillFor} style={s.svg} />
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
    maxWidth: '160px',
    height: 'auto',
  },
}
