import { useState } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import {
  STATE_DEFS, QUICK_ACTIONS, MAP_ACTIONS,
  calcIniDelta,
} from './combatSections.js'

// ---------------------------------------------------------------------------
// Etat par defaut par cle (= DEFAULT colonne DB)
// ---------------------------------------------------------------------------
const STATE_DEFAULTS = {
  position:  'standing',
  weapon:    'holstered',
  fire_mode: 'cc',
  cover:     'exposed',
  vitesse:   'normal',
}

// Cycle au prochain etat (circulaire). Si cle inconnue -> retourne le defaut.
function nextKey(stateKey, currentKey) {
  const states = STATE_DEFS[stateKey].states
  const idx    = states.findIndex(s => s.k === currentKey)
  if (idx === -1) return STATE_DEFAULTS[stateKey]
  return states[(idx + 1) % states.length].k
}

// ---------------------------------------------------------------------------
// InlineChip — puce click-to-cycle compacte
// ---------------------------------------------------------------------------
function InlineChip({ stateKey, initial, current, onChange }) {
  const def     = STATE_DEFS[stateKey]
  const isMixed = current === '__mixed__'
  const cur     = isMixed ? null : def.states.find(s => s.k === current)
  const cost    = isMixed ? null : (current === initial
    ? 0
    : (def.cost?.[initial]?.[current] ?? 0))

  const handleClick = () => {
    if (isMixed) {
      onChange(STATE_DEFAULTS[stateKey])
    } else {
      onChange(nextKey(stateKey, current))
    }
  }

  return (
    <div onClick={handleClick} style={S.chip}>
      <span style={S.chipLabel}>{def.label}</span>
      <span style={{ ...S.chipValue, ...(isMixed ? S.chipMixed : {}) }}>
        {isMixed ? '— mixte —' : (cur?.l ?? current)}
      </span>
      {!isMixed && cost !== 0 && cost !== null && (
        <span style={{ ...S.chipCost, color: cost > 0 ? '#3aaa6a' : '#c86030' }}>
          {cost > 0 ? `+${cost}` : cost}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
export default function CombatGmDeclareWindow({ socket, characters }) {
  const { roster } = useCombatStore()
  const tokens     = useTokenStore(s => s.tokens)

  const [focusedId,   setFocusedId]   = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selections,  setSelections]  = useState({})   // tokenId -> { states, mapAction, quick }

  // ── Helpers identification PNJ ──────────────────────────────────────────
  const isPnj = (entry) => {
    const token = tokens.find(t => t.id === entry.token_id)
    if (!token?.character_id) return false
    return characters.find(c => c.id === token.character_id)?.type === 'pnj'
  }
  const getLabel = (tokenId) => tokens.find(t => t.id === tokenId)?.label ?? tokenId

  const allPnjs        = roster.filter(r => r.status === 'active').filter(isPnj)
  const sortedPnjs     = [...allPnjs].sort((a, b) => b.initiative - a.initiative)
  const unannouncedCnt = allPnjs.filter(r => !r.has_announced).length

  if (allPnjs.length === 0) return null

  // ── Selection locale par PNJ ────────────────────────────────────────────
  const getInitialStates = (entry) => ({
    position:  entry.state_position  ?? 'standing',
    weapon:    entry.state_weapon    ?? 'holstered',
    fire_mode: entry.state_fire_mode ?? 'cc',
    cover:     entry.state_cover     ?? 'exposed',
    vitesse:   entry.state_vitesse   ?? 'normal',
  })

  const getSel = (tokenId) => {
    if (selections[tokenId]) return selections[tokenId]
    const entry = roster.find(r => r.token_id === tokenId)
    if (!entry) return { states: { ...STATE_DEFAULTS }, mapAction: null, quick: { observer: 0, reperer: 0, phrase: false } }
    return { states: getInitialStates(entry), mapAction: null, quick: { observer: 0, reperer: 0, phrase: false } }
  }

  // ── Batch mode ──────────────────────────────────────────────────────────
  const batchMode = selectedIds.size >= 2
  const activeFocusId = focusedId ?? sortedPnjs.find(r => !r.has_announced)?.token_id ?? null
  const targetIds = batchMode
    ? [...selectedIds]
    : (activeFocusId ? [activeFocusId] : [])

  // Agregat d'un etat sur les cibles (valeur unique ou '__mixed__')
  const aggregate = (stateKey) => {
    if (!targetIds.length) return null
    const vals = new Set(targetIds.map(id => getSel(id).states[stateKey]))
    return vals.size === 1 ? [...vals][0] : '__mixed__'
  }
  const aggregateInitial = (stateKey) => {
    if (!targetIds.length) return null
    const vals = new Set(targetIds.map(id => {
      const entry = roster.find(r => r.token_id === id)
      return entry ? getInitialStates(entry)[stateKey] : STATE_DEFAULTS[stateKey]
    }))
    return vals.size === 1 ? [...vals][0] : '__mixed__'
  }

  // ── Mutations selection ─────────────────────────────────────────────────
  const updateState = (stateKey, value) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id]  = { ...cur, states: { ...cur.states, [stateKey]: value } }
      })
      return next
    })
  }

  const setMapAction = (key) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id]  = { ...cur, mapAction: cur.mapAction === key ? null : key }
      })
      return next
    })
  }

  const setQuick = (k, v) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id]  = { ...cur, quick: { ...cur.quick, [k]: v } }
      })
      return next
    })
  }

  // ── INI delta ───────────────────────────────────────────────────────────
  const calcDelta = (tokenId) => {
    const entry = roster.find(r => r.token_id === tokenId)
    if (!entry) return 0
    const sel = getSel(tokenId)
    return calcIniDelta(
      getInitialStates(entry),
      sel.states,
      { move: null, attack: null, melee: sel.mapAction === 'melee', multi: sel.mapAction === 'multi' },
      sel.quick,
    )
  }

  // Pour l'affichage footer (1 cible uniquement)
  const singleDelta = targetIds.length === 1 ? calcDelta(targetIds[0]) : null

  // ── Etat courant agrege pour les chips ─────────────────────────────────
  const curAction = (() => {
    if (!targetIds.length) return null
    const acts = new Set(targetIds.map(id => getSel(id).mapAction))
    return acts.size === 1 ? [...acts][0] : '__mixed__'
  })()

  const curQuick = (k) => {
    if (!targetIds.length) return 0
    if (k === 'phrase') {
      const vals = new Set(targetIds.map(id => getSel(id).quick.phrase))
      return vals.size === 1 ? [...vals][0] : false
    }
    const vals = new Set(targetIds.map(id => getSel(id).quick[k]))
    return vals.size === 1 ? [...vals][0] : 0
  }

  // canDeclare : au moins un changement OU une action
  const canDeclare = targetIds.length > 0 && targetIds.some(id => {
    const sel   = getSel(id)
    const entry = roster.find(r => r.token_id === id)
    if (!entry || entry.has_announced) return false
    const init  = getInitialStates(entry)
    const stateChanged = Object.keys(sel.states).some(k => sel.states[k] !== init[k])
    const hasAction    = !!sel.mapAction || sel.quick.observer > 0 || sel.quick.reperer > 0 || sel.quick.phrase
    return stateChanged || hasAction
  })

  // ── Declare ─────────────────────────────────────────────────────────────
  const handleDeclare = () => {
    if (!socket || !canDeclare) return
    const toEmit = targetIds.filter(id => {
      const entry = roster.find(r => r.token_id === id)
      return entry && !entry.has_announced
    })
    toEmit.forEach(tokenId => {
      const sel   = getSel(tokenId)
      const entry = roster.find(r => r.token_id === tokenId)
      socket.emit(WS.COMBAT_ACTION_DECLARE, {
        tokenId,
        state: { ...sel.states },
        mapActions: {
          move:     null,
          attack:   null,
          melee:    sel.mapAction === 'melee',
          multi:    sel.mapAction === 'multi',
          interact: sel.mapAction === 'interact',
        },
        quick: { ...sel.quick },
      })
    })
    // Auto-focus prochain todo
    const nextTodo = sortedPnjs.find(r => !r.has_announced && !toEmit.includes(r.token_id))
    setFocusedId(nextTodo?.token_id ?? null)
    setSelectedIds(new Set())
  }

  // ── Batch helpers ────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  const selectAll  = () => setSelectedIds(new Set(sortedPnjs.filter(r => !r.has_announced).map(r => r.token_id)))
  const selectNone = () => setSelectedIds(new Set())

  // ── MAP_ACTIONS disponibles pour le GM ──────────────────────────────────
  // move et attack : grisés (sprint dédiés)
  const GM_DISABLED = new Set(['move', 'attack'])

  // ── Render ───────────────────────────────────────────────────────────────
  const hasTargets = targetIds.length > 0

  return (
    <div style={S.window}>

      {/* HEADER */}
      <div style={{ ...S.header, ...(batchMode ? S.headerBatch : {}) }}>
        <span style={{ ...S.headerLabel, ...(batchMode ? S.headerLabelBatch : {}) }}>
          {batchMode ? `BATCH — ${targetIds.length} PNJs` : 'PHASE 1 — DÉCLARATION'}
        </span>
        <span style={S.headerProgress}>{allPnjs.length - unannouncedCnt}/{allPnjs.length} déclarés</span>
      </div>

      {/* CONTROLS — visibles si au moins 1 cible */}
      {hasTargets && (
        <div style={S.controls}>

          {/* TACTIQUE */}
          <div style={S.section}>
            <span style={S.sectionTitle}>TACTIQUE</span>
            <div style={S.chips}>
              {['position', 'cover', 'vitesse'].map(k => (
                <InlineChip key={k} stateKey={k}
                  initial={aggregateInitial(k)}
                  current={aggregate(k)}
                  onChange={v => updateState(k, v)} />
              ))}
            </div>
          </div>

          {/* ARMEMENT */}
          <div style={S.section}>
            <span style={{ ...S.sectionTitle, color: '#aa6a30' }}>ARMEMENT</span>
            <div style={S.chips}>
              {['weapon', 'fire_mode'].map(k => (
                <InlineChip key={k} stateKey={k}
                  initial={aggregateInitial(k)}
                  current={aggregate(k)}
                  onChange={v => updateState(k, v)} />
              ))}
            </div>
          </div>

          {/* ACTION */}
          <div style={S.section}>
            <span style={{ ...S.sectionTitle, color: '#aa8a30' }}>ACTION</span>
            <div style={S.actionGrid}>
              {MAP_ACTIONS.map(a => {
                const disabled = GM_DISABLED.has(a.k)
                const active   = !disabled && curAction === a.k
                return (
                  <div key={a.k}
                    title={a.tooltip}
                    onClick={() => !disabled && setMapAction(a.k)}
                    style={{
                      ...S.actionBtn,
                      ...(active   ? S.actionBtnActive   : {}),
                      ...(disabled ? S.actionBtnDisabled : {}),
                    }}
                  >
                    <span style={{ ...S.actionLabel, color: active ? '#e8c870' : (disabled ? '#2a3040' : '#aaccdd') }}>
                      {a.l}
                    </span>
                    {a.ini && !disabled && (
                      <span style={{ ...S.actionIni, color: active ? '#e8c870' : '#5a6070' }}>{a.ini}</span>
                    )}
                    {disabled && (
                      <span style={S.actionDisabledTag}>sprint dédié</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* RAPIDES */}
          <div style={{ ...S.section, borderBottom: 'none' }}>
            <span style={{ ...S.sectionTitle, color: '#5a8a5a' }}>ACTIONS RAPIDES</span>
            <div style={S.quickList}>
              {QUICK_ACTIONS.map(qa => {
                if (qa.kind === 'incremental') {
                  const val = curQuick(qa.k)
                  return (
                    <div key={qa.k}
                      title={qa.tooltip}
                      style={{ ...S.quickRow, ...(val > 0 ? S.quickRowActive : {}) }}
                      onClick={() => val === 0 && setQuick(qa.k, 1)}
                    >
                      <span style={S.quickLabel}>{qa.l}</span>
                      <div style={S.sliderWrap} onClick={val > 0 ? e => e.stopPropagation() : undefined}>
                        <input type="range" min={0} max={qa.max} step={1} value={val}
                          disabled={val === 0}
                          style={{ ...S.slider, opacity: val > 0 ? 1 : 0.3 }}
                          onChange={e => setQuick(qa.k, Number(e.target.value))} />
                        <span style={{ ...S.sliderVal, color: val > 0 ? '#5b8dee' : '#456575' }}>
                          {val > 0 ? `${val * qa.stepIni}` : '–'}
                        </span>
                      </div>
                    </div>
                  )
                }
                const isOn = !!curQuick(qa.k)
                return (
                  <div key={qa.k}
                    title={qa.tooltip}
                    style={{ ...S.quickRow, ...(isOn ? S.quickRowActive : {}) }}
                    onClick={() => setQuick(qa.k, !isOn)}
                  >
                    <span style={S.quickLabel}>{qa.l}</span>
                    {qa.ini && <span style={{ color: isOn ? '#5b8dee' : '#456575', fontSize: 10 }}>{qa.ini}</span>}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ROSTER */}
      <div style={S.roster}>
        <div style={S.rosterHeader}>
          <span style={S.rosterTitle}>ROSTER — {allPnjs.length} PNJs</span>
          {selectedIds.size > 0 && (
            <span onClick={selectNone} style={S.rosterLink}>✕ déselect. ({selectedIds.size})</span>
          )}
          {unannouncedCnt > 0 && selectedIds.size < unannouncedCnt && (
            <span onClick={selectAll} style={{ ...S.rosterLink, color: '#456575' }}>tout</span>
          )}
        </div>
        <div style={S.rosterList}>
          {sortedPnjs.map(entry => {
            const tid      = entry.token_id
            const isActive = !batchMode && tid === activeFocusId
            const isSel    = selectedIds.has(tid)
            const isDone   = entry.has_announced
            const delta    = isDone ? null : calcDelta(tid)

            return (
              <div key={tid}
                onClick={() => { if (!isDone) setFocusedId(tid) }}
                style={{
                  ...S.rosterRow,
                  ...(isActive ? S.rosterRowActive : {}),
                  ...(isSel    ? S.rosterRowSel    : {}),
                  opacity: isDone ? 0.35 : 1,
                  cursor: isDone ? 'default' : 'pointer',
                }}
              >
                <input type="checkbox"
                  checked={isSel}
                  disabled={isDone}
                  onClick={e => e.stopPropagation()}
                  onChange={() => !isDone && toggleSelect(tid)}
                  style={{ accentColor: '#aa6030', cursor: isDone ? 'default' : 'pointer', flexShrink: 0 }} />

                <span style={{ ...S.rosterGlyph, color: isDone ? '#5a7080' : (isSel ? '#aa8a30' : '#456575') }}>
                  {isDone ? '✓' : (isSel ? '◉' : '○')}
                </span>

                <span style={{ ...S.rosterName, fontWeight: isActive ? 600 : 400 }}>
                  {getLabel(tid)}
                </span>

                <span style={S.rosterIni}>INI {entry.initiative}</span>

                {delta !== null && delta !== 0 && (
                  <span style={{ ...S.rosterDelta, color: delta < 0 ? '#c86030' : '#3aaa6a' }}>
                    →{entry.initiative + delta}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* FOOTER */}
      <div style={S.footer}>
        {singleDelta !== null && singleDelta !== 0 && (
          <div style={S.iniRow}>
            <span style={S.iniLabel}>INI TOTAL</span>
            <span style={{ ...S.iniValue, color: singleDelta < -10 ? '#c83030' : (singleDelta < 0 ? '#c86030' : '#3aaa6a') }}>
              {singleDelta > 0 ? `+${singleDelta}` : singleDelta}
            </span>
          </div>
        )}
        {batchMode && (
          <div style={S.batchWarn}>⚠ coûts INI calculés individuellement</div>
        )}
        <button
          style={{ ...S.btnDeclare, ...(!canDeclare ? S.btnDeclareDisabled : {}) }}
          onClick={handleDeclare}
          disabled={!canDeclare}
        >
          {batchMode ? `DÉCLARER ×${targetIds.length}` : 'DÉCLARER'}
        </button>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  window: {
    position: 'absolute', bottom: 24, right: 16,
    width: 440, maxHeight: 'calc(100vh - 100px)',
    background: 'rgba(8,12,20,0.97)',
    border: '1.5px solid #15212e',
    borderRadius: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    pointerEvents: 'auto',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui',
  },

  // Header
  header: { padding: '8px 12px', background: '#06080e', borderBottom: '1px solid #15212e', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerBatch: { background: '#2a1810' },
  headerLabel: { fontSize: 9, letterSpacing: '0.15em', fontWeight: 700, color: '#3a8aaa', flex: 1 },
  headerLabelBatch: { color: '#e8c870' },
  headerProgress: { fontSize: 9, color: '#5a6575', fontFamily: 'monospace' },

  // Controls
  controls: { flexShrink: 0, borderBottom: '1px solid #15212e' },
  section: { padding: '6px 12px 8px', borderBottom: '1px solid #0e1520' },
  sectionTitle: { display: 'block', fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: '#3a8aaa', marginBottom: 5 },

  // InlineChip
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#0a1018', border: '1px solid #1a2a38', borderRadius: 2, cursor: 'pointer', userSelect: 'none' },
  chipLabel: { fontSize: 7, color: '#456575', letterSpacing: '0.1em', fontFamily: 'monospace' },
  chipValue: { fontSize: 10, color: '#dde7ee', fontWeight: 600 },
  chipMixed: { color: '#aa8a30', fontStyle: 'italic', fontWeight: 400 },
  chipCost: { fontSize: 8, fontFamily: 'monospace', fontWeight: 700 },

  // Action grid
  actionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  actionBtn: { padding: '5px 8px', background: '#0a1018', border: '1px solid #15212e', borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  actionBtnActive: { background: '#2a1e10', border: '1px solid #aa8a30' },
  actionBtnDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  actionLabel: { fontSize: 10, flex: 1 },
  actionIni: { fontSize: 8, fontFamily: 'monospace', flexShrink: 0 },
  actionDisabledTag: { fontSize: 7, color: '#2a3848', fontFamily: 'monospace', flexShrink: 0 },

  // Quick actions
  quickList: { display: 'flex', flexDirection: 'column', gap: 3 },
  quickRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.01)', border: '1px solid transparent', cursor: 'pointer' },
  quickRowActive: { background: 'rgba(91,141,238,0.1)', border: '1px solid #2a3a5e' },
  quickLabel: { fontSize: 10, color: '#aaccdd', flex: 1 },
  sliderWrap: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  slider: { width: 64, accentColor: '#5b8dee', cursor: 'pointer' },
  sliderVal: { fontSize: 10, fontFamily: 'monospace', minWidth: 14, textAlign: 'right' },

  // Roster
  roster: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#070a10' },
  rosterHeader: { padding: '5px 12px', background: '#060810', borderBottom: '1px solid #15212e', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  rosterTitle: { fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: '#aa6030', flex: 1, fontFamily: 'monospace' },
  rosterLink: { fontSize: 8, color: '#aa8a30', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.06em' },
  rosterList: { flex: 1, overflowY: 'auto' },
  rosterRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 8px', borderBottom: '1px solid #0e1520', borderLeft: '3px solid transparent', transition: 'opacity 0.15s' },
  rosterRowActive: { background: '#0a1828', borderLeftColor: '#3a8aaa' },
  rosterRowSel:    { background: '#181410', borderLeftColor: '#aa8a30' },
  rosterGlyph: { fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0, fontFamily: 'monospace' },
  rosterName: { fontSize: 10, color: '#aaccdd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rosterIni: { fontSize: 9, color: '#456575', flexShrink: 0, fontFamily: 'monospace' },
  rosterDelta: { fontSize: 9, flexShrink: 0, fontFamily: 'monospace', fontWeight: 700 },

  // Footer
  footer: { padding: '8px 12px', background: '#06080e', borderTop: '1.5px solid #15212e', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  iniRow: { display: 'flex', alignItems: 'center', gap: 8 },
  iniLabel: { fontSize: 9, color: '#456575', letterSpacing: '0.12em', fontFamily: 'monospace', flex: 1 },
  iniValue: { fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' },
  batchWarn: { fontSize: 8, color: '#aa8a30', fontFamily: 'monospace', padding: '4px 6px', background: '#1a1410', border: '1px solid #aa8a3044', borderRadius: 2 },
  btnDeclare: { padding: '7px 12px', background: 'rgba(80,200,120,0.12)', border: '1px solid #50c878', borderRadius: 3, color: '#50c878', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', fontFamily: 'monospace' },
  btnDeclareDisabled: { opacity: 0.35, cursor: 'not-allowed' },
}
