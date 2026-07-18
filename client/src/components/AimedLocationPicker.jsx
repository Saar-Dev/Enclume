import { useState } from 'react'
import BodySilhouetteSvg from './BodySilhouetteSvg.jsx'
import { AIMED_LOCATION_MALUS, LOCATION_LABELS } from '../../../shared/armorConstants.js'

const NEUTRAL_FILL = '#2a2a3e'
const HOVER_FILL = '#3a3a5a'
const SELECTED_FILL = '#f5c542'

function formatMalus(n) { return n > 0 ? `+${n}` : `${n}` }

// Viser une Localisation précise (LdB p.229-230, COM9, docs/PLAN_TIRVISE v2.md) — picker interactif,
// aucune condition d'éligibilité (contrairement à Tir visé) : toujours sélectionnable indépendamment
// du reste de la déclaration.
export default function AimedLocationPicker({ aimedLocation, onChange }) {
  const [hovered, setHovered] = useState(null)

  const fillFor = (loc) => {
    if (loc === aimedLocation) return SELECTED_FILL
    if (loc === hovered) return HOVER_FILL
    return NEUTRAL_FILL
  }

  const displayLoc = hovered ?? aimedLocation

  return (
    <div style={s.wrapper}>
      <div style={s.svgWrap}>
        <BodySilhouetteSvg
          fillFor={fillFor}
          onClickLocation={(loc) => onChange(loc === aimedLocation ? null : loc)}
          onHoverLocation={setHovered}
          style={s.svg}
        />
      </div>
      <div style={s.info}>
        {displayLoc ? (
          <span style={s.infoText}>
            {LOCATION_LABELS[displayLoc]} ({formatMalus(AIMED_LOCATION_MALUS[displayLoc])})
          </span>
        ) : (
          <span style={s.infoTextMuted}>Aucune (aléatoire)</span>
        )}
        {aimedLocation && (
          <button type="button" className="btn btn-ghost" style={s.clearBtn} onClick={() => onChange(null)}>
            Aucune
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  wrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  svgWrap: { width: '100%', display: 'flex', justifyContent: 'center' },
  svg: { width: '45%', maxWidth: 130, height: 'auto' },
  info: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 18 },
  infoText: { fontSize: 11, color: '#f5c542', fontWeight: 700 },
  infoTextMuted: { fontSize: 11, color: '#5b5b7a' },
  clearBtn: { fontSize: 10, padding: '2px 8px' },
}
