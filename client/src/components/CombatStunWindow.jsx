import { useState } from 'react'
import { WS } from '../../../shared/events.js'

const OUTCOME_CONFIG = {
  etourdi:     { label: 'Étourdi',     col: '#f5c542', desc: '1D6 tours' },
  inconscient: { label: 'Inconscient', col: '#c83030', desc: '1D6 × 10 tours' },
}

export default function CombatStunWindow({ payload, socket, onConfirmed }) {
  const [isRolling, setIsRolling] = useState(false)

  const handleLancer = () => {
    setIsRolling(true)
    socket?.emit(WS.COMBAT_STUN_CONFIRM, { tokenId: payload.tokenId })
    onConfirmed?.()
  }

  const { label, col, desc } = OUTCOME_CONFIG[payload.outcome] ?? { label: payload.outcome, col: '#7a7a90', desc: '1D6' }

  return (
    <div style={styles.overlay}>
      <div className="combat-float-win" style={{ minWidth: 300, maxWidth: 380, padding: '18px 22px', gap: 14 }}>

        <div className="combat-float-header" style={{ alignItems: 'baseline', borderBottom: '1px solid var(--border-session)', paddingBottom: 10, cursor: 'default' }}>
          <span style={styles.headerTitle}>Durée d'étourdissement</span>
        </div>

        <div style={{ padding: '10px 12px', background: col + '14', border: `1px solid ${col}66`, borderLeft: `3px solid ${col}`, borderRadius: 4 }}>
          <div style={{ fontSize: 18, color: col, fontWeight: 700, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#9090a0' }}>Lancez {desc} pour déterminer la durée</div>
        </div>

        <button
          style={{ ...styles.actionBtn, borderColor: col, color: col, opacity: isRolling ? 0.45 : 1, cursor: isRolling ? 'default' : 'pointer' }}
          onClick={handleLancer}
          disabled={isRolling}
        >
          {isRolling ? 'Envoi...' : 'Lancer 1D6'}
        </button>

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 1100,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#c0c0d0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  actionBtn: {
    width: '100%',
    padding: '10px 0',
    background: 'transparent',
    border: '1px solid',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}
