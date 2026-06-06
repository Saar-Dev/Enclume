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
      <div className="combat-float-win" style={{ minWidth: 340, maxWidth: 420, padding: '18px 22px', gap: 14 }}>

        <div className="combat-float-header" style={{ alignItems: 'baseline', borderBottom: '1px solid var(--border-session)', paddingBottom: 10, cursor: 'default' }}>
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

        {results?.shockResult?.triggered && (() => {
          const OUTCOME = {
            ok:          { label: 'Résistance',  col: '#3aaa6a' },
            etourdi:     { label: 'Étourdi',     col: '#f5c542' },
            inconscient: { label: 'Inconscient', col: '#c83030' },
          }
          const { label, col } = OUTCOME[results.shockResult.outcome] ?? { label: results.shockResult.outcome, col: '#7a7a90' }
          return (
            <div style={{ padding: '8px 10px', background: col + '14', border: `1px solid ${col}66`, borderLeft: `3px solid ${col}`, borderRadius: 4 }}>
              <div style={{ fontSize: 9, color: '#5b5b7a', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
                Test de Choc
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, color: col, fontWeight: 700, fontFamily: 'monospace' }}>{results.shockResult.roll}</span>
                <span style={{ fontSize: 11, color: '#5b5b7a' }}>/ seuil {results.shockResult.seuilEtourdi}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: col, fontWeight: 700 }}>{label}</span>
              </div>
            </div>
          )
        })()}

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
