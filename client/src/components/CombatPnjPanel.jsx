import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'

export default function CombatPnjPanel({ isOpen, onClose, socket, characters }) {
  const { t } = useTranslation('combat')
  const { roster } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  if (!isOpen) return null

  const active = roster.filter(r => r.status === 'active')

  const isPnj = (r) => {
    const token = tokens.find(t => t.id === r.token_id)
    if (!token || !token.character_id) return false
    const char = characters.find(c => c.id === token.character_id)
    return char?.type === 'pnj'
  }

  const pnjs = active.filter(isPnj)
  const pjs = active.filter(r => !isPnj(r))

  const getLabel = (tokenId) => {
    const token = tokens.find(t => t.id === tokenId)
    return token?.label ?? tokenId
  }

  const handleSkipPj = (tokenId) => {
    socket?.emit(WS.COMBAT_SKIP_PLAYER, { tokenId })
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.window} onClick={e => e.stopPropagation()}>

        <div style={styles.header}>
          <span>{t('pnjPanel.header')}</span>
          <button style={styles.btnClose} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>

          {/* Section PNJs — lecture seule */}
          {pnjs.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t('pnjPanel.pnjsSection')}</div>
              {pnjs.map(entry => (
                <div key={entry.token_id} style={{ ...styles.row, ...(entry.has_announced ? styles.rowDone : {}) }}>
                  <span style={styles.nameCell}>{getLabel(entry.token_id)}</span>
                  <span style={styles.iniCell}>{t('ini')} {entry.initiative}</span>
                  {entry.has_announced && <span style={styles.doneBadge}>✓</span>}
                </div>
              ))}
            </div>
          )}

          {/* Section PJs */}
          {pjs.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t('pnjPanel.pjsSection')}</div>
              {pjs.map(entry => (
                <div key={entry.token_id} style={{ ...styles.row, ...(entry.has_announced ? styles.rowDone : {}) }}>
                  <span style={styles.nameCell}>{getLabel(entry.token_id)}</span>
                  <span style={styles.iniCell}>{t('ini')} {entry.initiative}</span>
                  {entry.has_announced ? (
                    <span style={styles.doneBadge}>✓</span>
                  ) : (
                    <button style={styles.btnSkip} onClick={() => handleSkipPj(entry.token_id)}>
                      {t('pnjPanel.skipButton')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {pnjs.length === 0 && pjs.length === 0 && (
            <p style={styles.empty}>{t('pnjPanel.empty')}</p>
          )}

        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    zIndex: 1100,
  },
  window: {
    width: 420,
    maxHeight: 'calc(100vh - 120px)',
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#0e0e1a',
    fontSize: 13,
    color: '#c0c0d0',
    fontWeight: 600,
    flexShrink: 0,
  },
  btnClose: {
    background: 'none',
    border: 'none',
    color: '#5b5b7a',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 2px',
  },
  body: {
    overflowY: 'auto',
    flex: 1,
  },
  section: {
    padding: '8px 0',
    borderBottom: '1px solid #1e1e2e',
  },
  sectionTitle: {
    padding: '0 14px 6px',
    fontSize: 10,
    fontWeight: 700,
    color: '#5b5b7a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    minHeight: 34,
  },
  rowDone: {
    opacity: 0.45,
  },
  nameCell: {
    fontSize: 12,
    color: '#c0c0d0',
    fontWeight: 500,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  iniCell: {
    fontSize: 11,
    color: '#5b8dee',
    flexShrink: 0,
    minWidth: 44,
    textAlign: 'right',
  },
  doneBadge: {
    fontSize: 12,
    color: '#50c878',
    fontWeight: 700,
    flexShrink: 0,
  },
  btnSkip: {
    padding: '4px 9px',
    background: 'rgba(224,80,80,0.1)',
    border: '1px solid #e05b5b',
    borderRadius: 4,
    color: '#e05b5b',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  empty: {
    padding: '14px',
    fontSize: 12,
    color: '#5b5b7a',
    margin: 0,
    textAlign: 'center',
  },
}
