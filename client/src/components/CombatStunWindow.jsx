import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'

// label/desc = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le
// composant via t(), jamais affichee brute ici. Config locale a ce fichier (non exportee).
const OUTCOME_CONFIG = {
  etourdi:     { label: 'stunWindow.outcomes.etourdi.label',     col: '#f5c542', desc: 'stunWindow.outcomes.etourdi.desc' },
  inconscient: { label: 'stunWindow.outcomes.inconscient.label', col: '#c83030', desc: 'stunWindow.outcomes.inconscient.desc' },
}

export default function CombatStunWindow({ payload, socket, onClose }) {
  const { t } = useTranslation('combat')
  const [isRolling, setIsRolling] = useState(false)

  const handleLancer = () => {
    setIsRolling(true)
    socket?.emit(WS.COMBAT_STUN_CONFIRM, { tokenId: payload.tokenId })
    onClose?.()
  }

  const outcome = OUTCOME_CONFIG[payload.outcome]
  const label = outcome ? t(outcome.label) : payload.outcome
  const col   = outcome?.col ?? '#7a7a90'
  const desc  = outcome ? t(outcome.desc) : t('stunWindow.outcomes.defaultDesc')

  return (
    <div className="combat-stun-overlay">
      <div className="combat-float-win" style={{ minWidth: 300, maxWidth: 380, padding: '18px 22px', gap: 14 }}>

        <div className="combat-float-header" style={{ alignItems: 'baseline', borderBottom: '1px solid var(--border-session)', paddingBottom: 10, cursor: 'default' }}>
          <span className="combat-stun-header-title">{t('stunWindow.title')}</span>
        </div>

        <div style={{ padding: '10px 12px', background: col + '14', border: `1px solid ${col}66`, borderLeft: `3px solid ${col}`, borderRadius: 4 }}>
          <div className="combat-stun-outcome-label" style={{ color: col }}>{label}</div>
          <div className="combat-stun-outcome-desc">{t('stunWindow.rollPrompt', { desc })}</div>
        </div>

        <button
          className="btn"
          style={{ color: col, boxShadow: `inset 0 0 0 1px ${col}`, width: '100%', opacity: isRolling ? 0.45 : 1, cursor: isRolling ? 'default' : 'pointer' }}
          onClick={handleLancer}
          disabled={isRolling}
        >
          {isRolling ? t('stunWindow.sending') : t('stunWindow.rollButton')}
        </button>

      </div>
    </div>
  )
}
