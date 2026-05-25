import { useState } from 'react'
import { WS } from '../../../shared/events.js'

export default function CombatDamageWindow({ payload, results, socket, onConfirmed }) {
  const [isRolling, setIsRolling] = useState(false)

  const handleLancer = () => {
    setIsRolling(true)
    socket?.emit(WS.COMBAT_DAMAGE_CONFIRM, { tokenId: payload.tokenId })
  }

  const severityColor = results?.severityColor ?? '#5b8dee'

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes diceRoll {
          0%, 100% { transform: rotate(-8deg) scale(0.95); opacity: 0.5; }
          25%       { transform: rotate(8deg) scale(1.05); opacity: 0.9; }
          50%       { transform: rotate(-4deg) scale(0.98); opacity: 0.6; }
          75%       { transform: rotate(6deg) scale(1.02); opacity: 0.85; }
        }
        .dice-rolling { animation: diceRoll 0.35s ease-in-out infinite; }
      `}</style>
      <div style={styles.window}>

        <div style={styles.header}>
          <span style={styles.headerTitle}>Gestion des dégâts</span>
          <span style={styles.headerTarget}>→ {payload.targetName}</span>
        </div>

        <div style={styles.diceRow}>

          {/* Bloc Localisation */}
          <div style={styles.diceBlock}>
            <div style={styles.blockLabel}>Localisation (Distance)</div>
            <div className={isRolling && !results ? 'dice-rolling' : ''} style={styles.dieValue}>
              {results ? results.rollLoc : '?'}
            </div>
            {results ? (
              <div style={{ ...styles.zoneBadge, borderColor: severityColor, color: severityColor }}>
                {results.locLabel}
              </div>
            ) : (
              <div style={styles.badgePlaceholder}>D20</div>
            )}
          </div>

          <div style={styles.divider} />

          {/* Bloc Dégâts */}
          <div style={styles.diceBlock}>
            <div style={styles.blockLabel}>Dégâts ({payload.formula})</div>
            <div className={isRolling && !results ? 'dice-rolling' : ''} style={styles.dieValue}>
              {results ? results.degautsBruts : '?'}
            </div>
            {results ? (
              <>
                <div style={styles.rollsDetail}>[{results.dmgRolls.join(', ')}]</div>
                <div style={{ ...styles.netDmg, color: severityColor }}>{results.degatsNets} nets</div>
              </>
            ) : (
              <div style={styles.badgePlaceholder}>{payload.formula}</div>
            )}
          </div>

        </div>

        {results?.severity && (
          <div style={{ ...styles.severityBanner, background: severityColor + '22', borderColor: severityColor, color: severityColor }}>
            Blessure {results.severity}
          </div>
        )}

        {!results ? (
          <button
            style={{ ...styles.actionBtn, borderColor: '#5b8dee', color: '#5b8dee', opacity: isRolling ? 0.45 : 1, cursor: isRolling ? 'default' : 'pointer' }}
            onClick={handleLancer}
            disabled={isRolling}
          >
            {isRolling ? 'Calcul en cours...' : 'Lancer les dés'}
          </button>
        ) : (
          <button
            style={{ ...styles.actionBtn, borderColor: severityColor, color: severityColor, cursor: 'pointer' }}
            onClick={() => onConfirmed?.()}
          >
            Fermer
          </button>
        )}

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
  window: {
    pointerEvents: 'auto',
    background: '#0f0f1a',
    border: '1px solid #2a2a3e',
    borderRadius: 10,
    padding: '18px 22px',
    minWidth: 340,
    maxWidth: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    borderBottom: '1px solid #1e1e2e',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#c0c0d0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  headerTarget: {
    fontSize: 12,
    color: '#5b8dee',
  },
  diceRow: {
    display: 'flex',
    gap: 16,
    alignItems: 'stretch',
  },
  diceBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '10px 8px',
    background: '#16162a',
    borderRadius: 8,
    border: '1px solid #2a2a3e',
  },
  blockLabel: {
    fontSize: 10,
    color: '#5b5b7a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'center',
  },
  dieValue: {
    fontSize: 36,
    fontWeight: 700,
    color: '#c0c0d0',
    fontFamily: 'monospace',
    lineHeight: 1,
  },
  zoneBadge: {
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid',
    borderRadius: 4,
    padding: '2px 8px',
  },
  badgePlaceholder: {
    fontSize: 12,
    color: '#3a3a5a',
    fontWeight: 600,
    fontFamily: 'monospace',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    padding: '2px 8px',
  },
  rollsDetail: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  netDmg: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  divider: {
    width: 1,
    background: '#1e1e2e',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  severityBanner: {
    textAlign: 'center',
    padding: '6px 0',
    borderRadius: 6,
    border: '1px solid',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'capitalize',
    letterSpacing: '0.04em',
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
