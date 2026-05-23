import { useState } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { KEY_MOD, SECTIONS, formatMod } from './combatSections.js'

export default function CombatActionWindow({ socket, user, characters, pendingSurpriseRoll, onSurpriseRolled }) {
  const { roster } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [selectedKeys, setSelectedKeys] = useState(new Set())

  const playerChar = characters.find(c => c.user_id === user?.id)
  const playerToken = tokens.find(t => t.character_id === playerChar?.id)
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null

  if (!playerToken || !rosterEntry) return null

  const handleToggle = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleVarChange = (oldKey, newKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (oldKey) next.delete(oldKey)
      next.add(newKey)
      return next
    })
  }

  const totalMod = [...selectedKeys].reduce((sum, k) => sum + (KEY_MOD[k] ?? 0), 0)
  const canDeclare = selectedKeys.size > 0

  const handleDeclare = () => {
    if (!socket || !playerToken || !canDeclare) return
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      selectedKeys: Array.from(selectedKeys),
      weaponInvId: null,
    })
  }

  // Mode jet de surprise
  if (pendingSurpriseRoll?.tokenId === playerToken.id) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>⚠ Surprise !</div>
        <p style={styles.surpriseText}>
          Vous êtes surpris. Lancez 1d20 pour déterminer votre initiative.
        </p>
        <button style={styles.btnRoll} onClick={onSurpriseRolled}>
          Lancer le dé d'initiative
        </button>
      </div>
    )
  }

  // Surprise échouée
  if (rosterEntry.is_surprised && rosterEntry.has_announced && rosterEntry.initiative === 0) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>⚠ Surprise !</div>
        <p style={styles.surpriseText}>
          Vous êtes surpris — vous ne pouvez pas agir ce tour.
        </p>
      </div>
    )
  }

  // Déjà déclaré
  if (rosterEntry.has_announced) {
    return (
      <div style={styles.window}>
        <div style={styles.header}>Phase 1 - Déclaration d'intention</div>
        <p style={styles.waitText}>
          Action déclarée. En attente des autres participants…
        </p>
      </div>
    )
  }

  return (
    <div style={styles.window}>
      <div style={styles.header}>Phase 1 - Déclaration d'intention</div>

      <div style={styles.body}>
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
                  const selectedKey = [...selectedKeys].find(k => k.startsWith(item.key + '_'))
                  const isSelected = !!selectedKey
                  const currentMod = selectedKey ? KEY_MOD[selectedKey] : item.range.max
                  const sliderPos = item.range.max - currentMod
                  return (
                    <div
                      key={item.key}
                      style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}), gridColumn: 'span 2' }}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedKeys(prev => {
                            const next = new Set(prev)
                            ;[...next].filter(k => k.startsWith(item.key + '_')).forEach(k => next.delete(k))
                            return next
                          })
                        } else {
                          handleVarChange(null, `${item.key}_${Math.abs(item.range.max)}`)
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
                            handleVarChange(selectedKey, `${item.key}_${Math.abs(newMod)}`)
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
                const isSelected = selectedKeys.has(item.key)
                const modStr = formatMod(item)
                return (
                  <div
                    key={item.key}
                    style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}) }}
                    onClick={() => handleToggle(item.key)}
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

      <div style={styles.footer}>
        <span style={styles.totalMod}>
          INI total : {totalMod > 0 ? `+${totalMod}` : totalMod}
        </span>
        <button
          style={{ ...styles.btnDeclare, ...(!canDeclare ? styles.btnDeclareDisabled : {}) }}
          onClick={handleDeclare}
          disabled={!canDeclare}
        >
          Déclarer l'action
        </button>
      </div>
    </div>
  )
}

const styles = {
  window: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 360,
    maxHeight: 'calc(100vh - 80px)',
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
  section: {
    borderBottom: '1px solid #1e1e2e',
    paddingBottom: 4,
  },
  sectionTitle: {
    padding: '8px 14px 4px',
    fontSize: 10,
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
    padding: '6px 10px',
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
    padding: '6px 10px',
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
    minWidth: 30,
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
  footer: {
    padding: '10px 14px',
    borderTop: '1px solid #2a2a3e',
    background: '#0e0e1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  totalMod: {
    fontSize: 12,
    color: '#8888a8',
    fontWeight: 600,
  },
  btnDeclare: {
    padding: '7px 14px',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: 4,
    color: '#5b8dee',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDeclareDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  surpriseText: {
    padding: '14px 14px 0',
    fontSize: 12,
    color: '#e0a050',
    margin: 0,
    lineHeight: 1.5,
  },
  waitText: {
    padding: '14px',
    fontSize: 12,
    color: '#5b5b7a',
    margin: 0,
    textAlign: 'center',
  },
  btnRoll: {
    display: 'block',
    width: '100%',
    padding: '12px 14px',
    marginTop: 12,
    background: 'rgba(224,160,80,0.15)',
    border: 'none',
    borderTop: '1px solid #2a2a3e',
    color: '#e0a050',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
}
