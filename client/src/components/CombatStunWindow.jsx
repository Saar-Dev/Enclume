import { useState } from 'react'
import { WS } from '../../../shared/events.js'

const OUTCOME_CONFIG = {
  etourdi:     { label: 'Étourdi',     col: '#f5c542', desc: '1D6 tours' },
  inconscient: { label: 'Inconscient', col: '#c83030', desc: '1D6 × 10 tours' },
}

export default function CombatStunWindow({ payload, socket, onClose }) {
  const [isRolling, setIsRolling] = useState(false)

  const handleLancer = () => {
    setIsRolling(true)
    socket?.emit(WS.COMBAT_STUN_CONFIRM, { tokenId: payload.tokenId })
    onClose?.()
  }

  const { label, col, desc } = OUTCOME_CONFIG[payload.outcome] ?? { label: payload.outcome, col: '#7a7a90', desc: '1D6' }

  return (
    <div className="combat-stun-overlay">
      <div className="combat-float-win" style={{ minWidth: 300, maxWidth: 380, padding: '18px 22px', gap: 14 }}>

        <div className="combat-float-header" style={{ alignItems: 'baseline', borderBottom: '1px solid var(--border-session)', paddingBottom: 10, cursor: 'default' }}>
          <span className="combat-stun-header-title">Durée d'étourdissement</span>
        </div>

        <div style={{ padding: '10px 12px', background: col + '14', border: `1px solid ${col}66`, borderLeft: `3px solid ${col}`, borderRadius: 4 }}>
          <div className="combat-stun-outcome-label" style={{ color: col }}>{label}</div>
          <div className="combat-stun-outcome-desc">Lancez {desc} pour déterminer la durée</div>
        </div>

        <button
          className="btn"
          style={{ color: col, boxShadow: `inset 0 0 0 1px ${col}`, width: '100%', opacity: isRolling ? 0.45 : 1, cursor: isRolling ? 'default' : 'pointer' }}
          onClick={handleLancer}
          disabled={isRolling}
        >
          {isRolling ? 'Envoi...' : 'Lancer 1D6'}
        </button>

      </div>
    </div>
  )
}
