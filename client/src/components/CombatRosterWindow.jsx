import { useState, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api'

export default function CombatRosterWindow({ socket, battlemapId }) {
  const { phase, roster } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [surprisedIds, setSurprisedIds] = useState([])
  const [excludedIds, setExcludedIds] = useState([])
  const [iniPreview, setIniPreview] = useState({}) // { tokenId: base_ini }

  const inCombat = phase !== null

  // Fetch INI preview dès que battlemapId est disponible et combat pas encore démarré
  useEffect(() => {
    if (!battlemapId || inCombat) return
    api.get(`/battlemaps/${battlemapId}/combat-ini`)
      .then(res => {
        const map = {}
        for (const { token_id, base_ini } of res.data.iniPreview) {
          map[token_id] = base_ini
        }
        setIniPreview(map)
      })
      .catch(() => {}) // non bloquant
  }, [battlemapId, inCombat])

  const toggleSurprised = (tokenId) => {
    setSurprisedIds(prev =>
      prev.includes(tokenId) ? prev.filter(id => id !== tokenId) : [...prev, tokenId]
    )
  }

  const toggleExcluded = (tokenId) => {
    setExcludedIds(prev =>
      prev.includes(tokenId) ? prev.filter(id => id !== tokenId) : [...prev, tokenId]
    )
  }

  const handleStart = () => {
    if (!socket || !battlemapId) return
    socket.emit(WS.COMBAT_START, {
      battlemap_id: battlemapId,
      surprisedTokenIds: surprisedIds,
      excludedTokenIds: excludedIds,
    })
  }

  const handleAnnounceStart = () => {
    if (!socket) return
    socket.emit(WS.COMBAT_ANNOUNCE_START)
  }

  // Avant COMBAT_START : affichage des tokens présents sur la carte
  // Après COMBAT_START  : affichage du roster calculé par le serveur
  const previewRows = inCombat
    ? roster.map(entry => {
        const token = tokens.find(t => t.id === entry.token_id)
        return {
          tokenId: entry.token_id,
          label: token?.label ?? entry.token_id,
          base_ini: entry.base_ini,
          is_surprised: entry.is_surprised,
          excluded: false,
        }
      })
    : tokens.map(token => ({
        tokenId: token.id,
        label: token.label ?? token.id,
        base_ini: iniPreview[token.id] ?? null,
        is_surprised: surprisedIds.includes(token.id),
        excluded: excludedIds.includes(token.id),
      }))

  const activeRows = inCombat ? previewRows : previewRows.filter(r => !r.excluded)
  const excludedRows = inCombat ? [] : previewRows.filter(r => r.excluded)

  return (
    <div style={styles.window}>
      <div style={styles.header}>
        <span style={styles.title}>⚔ Roster Combat</span>
        {inCombat && <span style={styles.phase}>{phase}</span>}
      </div>

      {previewRows.length === 0 && (
        <p style={styles.empty}>Aucun token sur la carte.</p>
      )}

      {activeRows.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Token</th>
              <th style={styles.th}>INI</th>
              <th style={styles.th}>Surpris</th>
              {!inCombat && <th style={styles.th}>Inclus</th>}
            </tr>
          </thead>
          <tbody>
            {activeRows.map(row => (
              <tr key={row.tokenId}>
                <td style={styles.td}>{row.label}</td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  {row.base_ini != null ? row.base_ini : '—'}
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  {inCombat
                    ? (row.is_surprised ? '⚠' : '—')
                    : (
                      <input
                        type="checkbox"
                        checked={row.is_surprised}
                        onChange={() => toggleSurprised(row.tokenId)}
                        style={{ cursor: 'pointer' }}
                      />
                    )
                  }
                </td>
                {!inCombat && (
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!row.excluded}
                      onChange={() => toggleExcluded(row.tokenId)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {excludedRows.length > 0 && (
        <div style={styles.excludedSection}>
          <span style={styles.excludedLabel}>Exclus</span>
          {excludedRows.map(row => (
            <div key={row.tokenId} style={styles.excludedRow}>
              <span style={styles.excludedName}>{row.label}</span>
              <button
                style={styles.btnReinclude}
                onClick={() => toggleExcluded(row.tokenId)}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      {!inCombat && (
        <button
          style={{
            ...styles.btnStart,
            ...(activeRows.length === 0 ? styles.btnStartDisabled : {}),
          }}
          onClick={handleStart}
          disabled={activeRows.length === 0}
        >
          Démarrer le combat ({activeRows.length})
        </button>
      )}

      {inCombat && phase === 'ROSTER' && (
        <button style={styles.btnAnnounce} onClick={handleAnnounceStart}>
          Passer en Annonce →
        </button>
      )}
    </div>
  )
}

const styles = {
  window: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 300,
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#0e0e1a',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  title: {
    fontSize: 13,
    color: '#c0c0d0',
    fontWeight: 600,
  },
  phase: {
    fontSize: 11,
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  empty: {
    padding: '12px 14px',
    color: '#5b5b7a',
    fontSize: 12,
    margin: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '6px 14px',
    fontSize: 11,
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
    borderBottom: '1px solid #2a2a3e',
  },
  td: {
    padding: '7px 14px',
    fontSize: 12,
    color: '#c0c0d0',
    borderBottom: '1px solid #1e1e2e',
  },
  excludedSection: {
    padding: '8px 14px',
    borderTop: '1px solid #2a2a3e',
    background: 'rgba(0,0,0,0.15)',
  },
  excludedLabel: {
    display: 'block',
    fontSize: 10,
    color: '#5b5b7a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  excludedRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '3px 0',
  },
  excludedName: {
    fontSize: 12,
    color: '#5b5b7a',
    textDecoration: 'line-through',
  },
  btnReinclude: {
    background: 'none',
    border: '1px solid #2a2a3e',
    borderRadius: 3,
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    padding: '1px 6px',
  },
  btnStart: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(91,141,238,0.15)',
    border: 'none',
    borderTop: '1px solid #2a2a3e',
    color: '#5b8dee',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  btnStartDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  btnAnnounce: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(80,200,120,0.12)',
    border: 'none',
    borderTop: '1px solid #2a2a3e',
    color: '#50c878',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
}
