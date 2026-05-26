import { useState } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { QUICK_ACTIONS } from './combatSections.js'

// Actions MAP disponibles pour PNJ (move et attack nécessitent une UI dédiée non implémentée ici)
const GM_MAP_ACTIONS = [
  { k: 'melee',    l: 'Corps à corps', ini: -3 },
  { k: 'multi',    l: 'Attaque multiple', ini: -5 },
  { k: 'interact', l: 'Interagir', ini: 0 },
]

export default function CombatGmDeclareWindow({ socket, characters }) {
  const { roster } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [selections, setSelections] = useState({})
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

  const unannouncedPnjs = allPnjs.filter(r => !r.has_announced).sort((a, b) => b.initiative - a.initiative)
  const declaredPnjs    = allPnjs.filter(r => r.has_announced).sort((a, b) => b.initiative - a.initiative)
  const displayPnjs     = [...unannouncedPnjs, ...declaredPnjs]

  const getLabel = (tokenId) => tokens.find(t => t.id === tokenId)?.label ?? tokenId
  const activeOpenId = unannouncedPnjs.some(r => r.token_id === openTokenId)
    ? openTokenId
    : unannouncedPnjs[0]?.token_id ?? null

  const getSel = (tokenId) => selections[tokenId] ?? {
    mapSelected: new Set(),
    quick: { observer: 0, reperer: 0, phrase: false },
  }

  const handleMapToggle = (tokenId, key) => {
    setSelections(prev => {
      const sel = getSel(tokenId)
      const next = new Set(sel.mapSelected)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return { ...prev, [tokenId]: { ...sel, mapSelected: next } }
    })
  }

  const handleQuick = (tokenId, k, v) => {
    setSelections(prev => {
      const sel = getSel(tokenId)
      return { ...prev, [tokenId]: { ...sel, quick: { ...sel.quick, [k]: v } } }
    })
  }

  const handleDeclare = (tokenId) => {
    const sel = getSel(tokenId)
    const entry = roster.find(r => r.token_id === tokenId)
    if (!entry) return

    const { mapSelected, quick } = sel
    const hasAction = mapSelected.size > 0 || quick.observer > 0 || quick.reperer > 0 || quick.phrase
    if (!hasAction) return

    socket?.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId,
      state: {
        position:  entry.state_position  ?? 'standing',
        weapon:    entry.state_weapon    ?? 'holstered',
        fire_mode: entry.state_fire_mode ?? 'cc',
        cover:     entry.state_cover     ?? 'exposed',
        vitesse:   entry.state_vitesse   ?? 'normal',
      },
      mapActions: {
        move:     null,
        attack:   null,
        melee:    mapSelected.has('melee'),
        multi:    mapSelected.has('multi'),
        interact: mapSelected.has('interact'),
      },
      quick,
    })
    const next = unannouncedPnjs.filter(r => r.token_id !== tokenId)[0]
    setOpenTokenId(next?.token_id ?? null)
  }

  return (
    <div style={S.window}>
      <div style={S.header}>Phase 1 — Annonces PNJs</div>
      <div style={S.body}>
        {unannouncedPnjs.length === 0 ? (
          <p style={S.allDone}>Tous les PNJs ont déclaré ✓</p>
        ) : (
          displayPnjs.map(entry => {
            if (entry.has_announced) {
              return (
                <div key={entry.token_id} style={S.rowDeclared}>
                  <span style={S.rowName}>{getLabel(entry.token_id)}</span>
                  <span style={S.rowIni}>INI {entry.initiative}</span>
                  <span style={S.doneBadge}>✓</span>
                </div>
              )
            }

            const sel = getSel(entry.token_id)
            const { mapSelected, quick } = sel
            const canDeclare = mapSelected.size > 0 || quick.observer > 0 || quick.reperer > 0 || quick.phrase
            const isOpen = entry.token_id === activeOpenId

            if (!isOpen) {
              return (
                <div key={entry.token_id} style={S.rowCollapsed} onClick={() => setOpenTokenId(entry.token_id)}>
                  <span style={S.chevron}>▶</span>
                  <span style={S.rowName}>{getLabel(entry.token_id)}</span>
                  <span style={S.rowIni}>INI {entry.initiative}</span>
                  <span style={{ ...S.rowSummary, ...(canDeclare ? S.rowSummaryActive : {}) }}>
                    {canDeclare ? `${mapSelected.size} action(s)` : 'non déclaré'}
                  </span>
                </div>
              )
            }

            return (
              <div key={entry.token_id} style={S.rowExpanded}>
                <div style={S.expandedHeader}>
                  <span style={S.chevron}>▼</span>
                  <span style={S.rowName}>{getLabel(entry.token_id)}</span>
                  <span style={S.rowIni}>INI {entry.initiative}</span>
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Actions</div>
                  <div style={S.itemsGrid}>
                    {GM_MAP_ACTIONS.map(a => {
                      const isSelected = mapSelected.has(a.k)
                      return (
                        <div key={a.k} style={{ ...S.item, ...(isSelected ? S.itemSelected : {}) }}
                          onClick={() => handleMapToggle(entry.token_id, a.k)}>
                          <span style={S.itemLabel}>{a.l}</span>
                          {a.ini !== 0 && <span style={{ ...S.itemMod, ...(isSelected ? S.itemModSelected : {}) }}>{a.ini}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Actions rapides</div>
                  <div style={S.itemsGrid}>
                    {QUICK_ACTIONS.map(qa => {
                      if (qa.kind === 'incremental') {
                        const val = quick[qa.k] ?? 0
                        return (
                          <div key={qa.k} style={{ ...S.item, ...(val > 0 ? S.itemSelected : {}), gridColumn: 'span 2' }}
                            onClick={() => handleQuick(entry.token_id, qa.k, val > 0 ? 0 : 1)}>
                            <span style={S.itemLabel}>{qa.l}</span>
                            <div style={S.sliderRow} onClick={val > 0 ? e => e.stopPropagation() : undefined}>
                              <input type="range" min={0} max={qa.max} step={1} value={val}
                                disabled={val === 0}
                                style={{ ...S.slider, opacity: val > 0 ? 1 : 0.35 }}
                                onChange={e => handleQuick(entry.token_id, qa.k, Number(e.target.value))} />
                              <span style={{ ...S.sliderVal, ...(val > 0 ? S.sliderValSelected : {}) }}>{val}</span>
                            </div>
                          </div>
                        )
                      }
                      const isSelected = !!quick[qa.k]
                      return (
                        <div key={qa.k} style={{ ...S.item, ...(isSelected ? S.itemSelected : {}) }}
                          onClick={() => handleQuick(entry.token_id, qa.k, !isSelected)}>
                          <span style={S.itemLabel}>{qa.l}</span>
                          {qa.ini && <span style={{ ...S.itemMod, ...(isSelected ? S.itemModSelected : {}) }}>{qa.ini}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={S.expandedFooter}>
                  <button
                    style={{ ...S.btnDeclare, ...(!canDeclare ? S.btnDeclareDisabled : {}) }}
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

const S = {
  window: { position: 'absolute', bottom: 24, right: 16, width: 480, maxHeight: 'calc(100vh - 100px)', background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '10px 14px', borderBottom: '1px solid #2a2a3e', background: '#0e0e1a', fontSize: 13, color: '#c0c0d0', fontWeight: 600, flexShrink: 0 },
  body: { overflowY: 'auto', flex: 1 },
  allDone: { padding: '14px', fontSize: 12, color: '#50c878', margin: 0, textAlign: 'center' },
  rowDeclared: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', opacity: 0.3, borderBottom: '1px solid #1e1e2e' },
  rowCollapsed: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #1e1e2e', background: 'rgba(255,255,255,0.02)' },
  rowExpanded: { borderBottom: '1px solid #2a2a3e', background: 'rgba(91,141,238,0.04)' },
  expandedHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #2a2a3e', background: '#0e0e1a' },
  chevron: { fontSize: 9, color: '#5b5b7a', flexShrink: 0, width: 10 },
  rowName: { fontSize: 12, color: '#c0c0d0', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowIni: { fontSize: 11, color: '#5b8dee', flexShrink: 0 },
  rowSummary: { fontSize: 10, color: '#5b5b7a', flexShrink: 0, marginLeft: 4, whiteSpace: 'nowrap' },
  rowSummaryActive: { color: '#5b8dee' },
  doneBadge: { fontSize: 12, color: '#50c878', fontWeight: 700, flexShrink: 0 },
  section: { borderBottom: '1px solid #1a1a2a', paddingBottom: 2 },
  sectionTitle: { padding: '6px 14px 3px', fontSize: 9, fontWeight: 700, color: '#5b5b7a', textTransform: 'uppercase', letterSpacing: '0.06em' },
  itemsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', margin: '1px 6px', borderRadius: 4, cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid transparent' },
  itemSelected: { background: 'rgba(91,141,238,0.15)', borderColor: '#5b8dee' },
  itemLabel: { fontSize: 11, color: '#c0c0d0', flex: 1, marginRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMod: { fontSize: 10, color: '#5b5b7a', flexShrink: 0, minWidth: 28, textAlign: 'right' },
  itemModSelected: { color: '#5b8dee' },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  slider: { width: 70, accentColor: '#5b8dee', cursor: 'pointer' },
  sliderVal: { fontSize: 10, color: '#5b5b7a', minWidth: 26, textAlign: 'right' },
  sliderValSelected: { color: '#5b8dee' },
  expandedFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 14px', borderTop: '1px solid #2a2a3e', background: '#0e0e1a' },
  btnDeclare: { padding: '6px 12px', background: 'rgba(80,200,120,0.15)', border: '1px solid #50c878', borderRadius: 4, color: '#50c878', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnDeclareDisabled: { opacity: 0.4, cursor: 'not-allowed' },
}
