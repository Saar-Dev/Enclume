import { useState } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { KEY_MOD, SECTIONS, formatMod } from './combatSections.js'

export default function CombatGmDeclareWindow({ socket, characters }) {
  const { roster } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [selections, setSelections] = useState({})  // tokenId → string[]
  const [openTokenId, setOpenTokenId] = useState(null)

  const active = roster.filter(r => r.status === 'active')

  const isPnj = (entry) => {
    const token = tokens.find(t => t.id === entry.token_id)
    if (!token || !token.character_id) return false
    const char = characters.find(c => c.id === token.character_id)
    return char?.type === 'pnj'
  }

  const allPnjs = active.filter(isPnj)
  if (allPnjs.length === 0) return null

  const unannouncedPnjs = allPnjs
    .filter(r => !r.has_announced)
    .sort((a, b) => b.initiative - a.initiative)
  const declaredPnjs = allPnjs
    .filter(r => r.has_announced)
    .sort((a, b) => b.initiative - a.initiative)
  const displayPnjs = [...unannouncedPnjs, ...declaredPnjs]

  const getLabel = (tokenId) => {
    const token = tokens.find(t => t.id === tokenId)
    return token?.label ?? tokenId
  }

  const activeOpenId = unannouncedPnjs.some(r => r.token_id === openTokenId)
    ? openTokenId
    : unannouncedPnjs[0]?.token_id ?? null

  const handleToggleOpen = (tokenId) => {
    if (tokenId !== activeOpenId) setOpenTokenId(tokenId)
  }

  const handleToggleKey = (tokenId, key) => {
    setSelections(prev => {
      const current = new Set(prev[tokenId] ?? [])
      if (current.has(key)) current.delete(key)
      else current.add(key)
      return { ...prev, [tokenId]: Array.from(current) }
    })
  }

  const handleVarChange = (tokenId, oldKey, newKey) => {
    setSelections(prev => {
      const current = new Set(prev[tokenId] ?? [])
      if (oldKey) current.delete(oldKey)
      current.add(newKey)
      return { ...prev, [tokenId]: Array.from(current) }
    })
  }

  const handleDeclare = (tokenId) => {
    const keys = selections[tokenId] ?? []
    if (keys.length === 0) return
    socket?.emit(WS.COMBAT_ACTION_DECLARE, { tokenId, selectedKeys: keys, weaponInvId: null })
    const next = unannouncedPnjs.filter(r => r.token_id !== tokenId)[0]
    setOpenTokenId(next?.token_id ?? null)
  }

  return (
    <div style={styles.window}>
      <div style={styles.header}>Phase 1 - Annonces PNJs</div>

      <div style={styles.body}>
        {unannouncedPnjs.length === 0 ? (
          <p style={styles.allDone}>Tous les PNJs ont déclaré ✓</p>
        ) : (
          displayPnjs.map(entry => {
            // Déclaré — ligne grisée
            if (entry.has_announced) {
              return (
                <div key={entry.token_id} style={styles.rowDeclared}>
                  <span style={styles.rowName}>{getLabel(entry.token_id)}</span>
                  <span style={styles.rowIni}>INI {entry.initiative}</span>
                  <span style={styles.doneBadge}>✓</span>
                </div>
              )
            }

            const keys = selections[entry.token_id] ?? []
            const totalMod = keys.reduce((sum, k) => sum + (KEY_MOD[k] ?? 0), 0)
            const canDeclare = keys.length > 0
            const isOpen = entry.token_id === activeOpenId

            // Non déclaré, collapsed
            if (!isOpen) {
              const summary = keys.length > 0
                ? `INI ${totalMod > 0 ? `+${totalMod}` : totalMod}`
                : 'non déclaré'
              return (
                <div
                  key={entry.token_id}
                  style={styles.rowCollapsed}
                  onClick={() => handleToggleOpen(entry.token_id)}
                >
                  <span style={styles.chevron}>▶</span>
                  <span style={styles.rowName}>{getLabel(entry.token_id)}</span>
                  <span style={styles.rowIni}>INI {entry.initiative}</span>
                  <span style={{ ...styles.rowSummary, ...(keys.length > 0 ? styles.rowSummaryActive : {}) }}>
                    {summary}
                  </span>
                </div>
              )
            }

            // Non déclaré, expanded
            return (
              <div key={entry.token_id} style={styles.rowExpanded}>
                <div style={styles.expandedHeader}>
                  <span style={styles.chevron}>▼</span>
                  <span style={styles.rowName}>{getLabel(entry.token_id)}</span>
                  <span style={styles.rowIni}>INI {entry.initiative}</span>
                </div>

                <div style={styles.actionList}>
                  {SECTIONS.map(section => (
                    <div key={section.key} style={styles.section}>
                      <div style={styles.sectionTitle}>{section.label}</div>
                      <div style={styles.itemsGrid}>
                        {section.items.map(item => {
                          // Item grisé
                          if (!item.active) {
                            const modStr = formatMod(item)
                            return (
                              <div key={item.key} style={styles.itemGreyed}>
                                <span style={styles.itemLabel}>{item.label}</span>
                                {modStr && <span style={styles.itemMod}>{modStr}</span>}
                              </div>
                            )
                          }

                          // Item à mod variable — slider
                          if (item.range) {
                            const selectedKey = keys.find(k => k.startsWith(item.key + '_'))
                            const isSelected = !!selectedKey
                            const currentMod = selectedKey ? KEY_MOD[selectedKey] : item.range.max
                            const sliderPos = item.range.max - currentMod
                            return (
                              <div
                                key={item.key}
                                style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}), gridColumn: 'span 2' }}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelections(prev => {
                                      const current = new Set(prev[entry.token_id] ?? [])
                                      ;[...current].filter(k => k.startsWith(item.key + '_')).forEach(k => current.delete(k))
                                      return { ...prev, [entry.token_id]: Array.from(current) }
                                    })
                                  } else {
                                    handleVarChange(entry.token_id, null, `${item.key}_${Math.abs(item.range.max)}`)
                                  }
                                }}
                              >
                                <span style={styles.itemLabel}>{item.label}</span>
                                <div style={styles.sliderRow} onClick={isSelected ? e => e.stopPropagation() : undefined}>
                                  <input
                                    type="range"
                                    min={0}
                                    max={item.range.max - item.range.min}
                                    step={item.range.step}
                                    value={sliderPos}
                                    disabled={!isSelected}
                                    style={{ ...styles.slider, opacity: isSelected ? 1 : 0.35 }}
                                    onChange={e => {
                                      const newMod = item.range.max - Number(e.target.value)
                                      handleVarChange(entry.token_id, selectedKey, `${item.key}_${Math.abs(newMod)}`)
                                    }}
                                  />
                                  <span style={{ ...styles.sliderVal, ...(isSelected ? styles.sliderValSelected : {}) }}>
                                    {currentMod}
                                  </span>
                                </div>
                              </div>
                            )
                          }

                          // Item à mod fixe
                          const isSelected = keys.includes(item.key)
                          const modStr = formatMod(item)
                          return (
                            <div
                              key={item.key}
                              style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}) }}
                              onClick={() => handleToggleKey(entry.token_id, item.key)}
                            >
                              <span style={styles.itemLabel}>{item.label}</span>
                              <span style={{ ...styles.itemMod, ...(isSelected ? styles.itemModSelected : {}) }}>
                                {modStr}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.expandedFooter}>
                  <span style={styles.totalMod}>
                    INI total : {totalMod > 0 ? `+${totalMod}` : totalMod}
                  </span>
                  <button
                    style={{ ...styles.btnDeclare, ...(!canDeclare ? styles.btnDeclareDisabled : {}) }}
                    onClick={() => handleDeclare(entry.token_id)}
                    disabled={!canDeclare}
                  >
                    Déclarer
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const styles = {
  window: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 500,
    maxHeight: 'calc(100vh - 100px)',
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#0e0e1a',
    fontSize: 13,
    color: '#c0c0d0',
    fontWeight: 600,
    flexShrink: 0,
  },
  body: {
    overflowY: 'auto',
    flex: 1,
  },
  allDone: {
    padding: '14px',
    fontSize: 12,
    color: '#50c878',
    margin: 0,
    textAlign: 'center',
  },
  rowDeclared: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    opacity: 0.3,
    borderBottom: '1px solid #1e1e2e',
  },
  rowCollapsed: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e1e2e',
    background: 'rgba(255,255,255,0.02)',
  },
  rowExpanded: {
    borderBottom: '1px solid #2a2a3e',
    background: 'rgba(91,141,238,0.04)',
  },
  expandedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#0e0e1a',
  },
  chevron: {
    fontSize: 9,
    color: '#5b5b7a',
    flexShrink: 0,
    width: 10,
  },
  rowName: {
    fontSize: 12,
    color: '#c0c0d0',
    fontWeight: 500,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowIni: {
    fontSize: 11,
    color: '#5b8dee',
    flexShrink: 0,
  },
  rowSummary: {
    fontSize: 10,
    color: '#5b5b7a',
    flexShrink: 0,
    marginLeft: 4,
    whiteSpace: 'nowrap',
  },
  rowSummaryActive: {
    color: '#5b8dee',
  },
  doneBadge: {
    fontSize: 12,
    color: '#50c878',
    fontWeight: 700,
    flexShrink: 0,
  },
  actionList: {},
  section: {
    borderBottom: '1px solid #1a1a2a',
    paddingBottom: 2,
  },
  sectionTitle: {
    padding: '6px 14px 3px',
    fontSize: 9,
    fontWeight: 700,
    color: '#5b5b7a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 10px',
    margin: '1px 6px',
    borderRadius: 4,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid transparent',
  },
  itemSelected: {
    background: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
  },
  itemGreyed: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 10px',
    margin: '1px 6px',
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  itemLabel: {
    fontSize: 11,
    color: '#c0c0d0',
    flex: 1,
    marginRight: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMod: {
    fontSize: 10,
    color: '#5b5b7a',
    flexShrink: 0,
    minWidth: 28,
    textAlign: 'right',
  },
  itemModSelected: {
    color: '#5b8dee',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  slider: {
    width: 70,
    accentColor: '#5b8dee',
    cursor: 'pointer',
  },
  sliderVal: {
    fontSize: 10,
    color: '#5b5b7a',
    minWidth: 26,
    textAlign: 'right',
  },
  sliderValSelected: {
    color: '#5b8dee',
  },
  expandedFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    borderTop: '1px solid #2a2a3e',
    background: '#0e0e1a',
  },
  totalMod: {
    fontSize: 11,
    color: '#8888a8',
    fontWeight: 600,
  },
  btnDeclare: {
    padding: '6px 12px',
    background: 'rgba(80,200,120,0.15)',
    border: '1px solid #50c878',
    borderRadius: 4,
    color: '#50c878',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDeclareDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
}
