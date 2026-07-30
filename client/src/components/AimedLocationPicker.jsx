import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BodySilhouetteSvg from './BodySilhouetteSvg.jsx'
import { AIMED_LOCATION_MALUS } from '../../../shared/armorConstants.js'
import { LOCATION_I18N_KEYS } from '../lib/locationI18nKeys.js'

const NEUTRAL_FILL = '#2a2a3e'
const HOVER_FILL = '#3a3a5a'
const SELECTED_FILL = '#f5c542'

function formatMalus(n) { return n > 0 ? `+${n}` : `${n}` }

// Viser une Localisation précise (LdB p.229-230, COM9, docs/PLAN_TIRVISE v2.md) — picker interactif,
// aucune condition d'éligibilité (contrairement à Tir visé) : toujours sélectionnable indépendamment
// du reste de la déclaration. showMalus=false (Lot 3, docs/PLAN_FATIGUE_DOMMAGES.md §9, increment G) :
// réutilisé tel quel pour choisir la "Localisation exposée" d'un danger environnemental (Acide/Feu) —
// contexte sans Test d'attaque, le malus de visée n'y a pas de sens.
export default function AimedLocationPicker({ aimedLocation, onChange, showMalus = true }) {
  const { t } = useTranslation('charSheet')
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
            {t(LOCATION_I18N_KEYS[displayLoc])}
            {showMalus && ` (${formatMalus(AIMED_LOCATION_MALUS[displayLoc])})`}
          </span>
        ) : (
          <span style={s.infoTextMuted}>{t('aimedLocationPicker.randomHint')}</span>
        )}
        {aimedLocation && (
          <button type="button" className="btn btn-ghost" style={s.clearBtn} onClick={() => onChange(null)}>
            {t('aimedLocationPicker.clearButton')}
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
