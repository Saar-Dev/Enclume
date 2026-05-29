import { useState } from 'react'
import { useDraggable } from '../lib/useDraggable.js'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { STATE_DEFS } from './combatSections.js'

function StateChip({ defKey, current, onChange }) {
  const def = STATE_DEFS[defKey]
  const cur = def.states.find(s => s.k === current)
  const handleClick = () => {
    const idx = def.states.findIndex(s => s.k === current)
    onChange(def.states[(idx + 1) % def.states.length].k)
  }
  return (
    <div onClick={handleClick} style={S.chip}>
      <span style={S.chipLabel}>{def.label}</span>
      <span style={S.chipValue}>{cur?.l ?? current}</span>
    </div>
  )
}

export default function CombatInitStateWindow({ socket, playerToken }) {
  const { roster } = useCombatStore()
  const entry = roster.find(e => e.token_id === playerToken?.id)

  const [position,  setPosition]  = useState(entry?.state_position  ?? 'standing')
  const [weapon,    setWeapon]    = useState(entry?.state_weapon    ?? 'holstered')
  const [fireMode,  setFireMode]  = useState(entry?.state_fire_mode ?? 'cc')
  const [confirmed, setConfirmed] = useState(false)

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-init-state-pos',
    { top: window.innerHeight - 220, left: window.innerWidth - 276 },
    260,
  )

  const handleConfirm = () => {
    if (!socket || !playerToken) return
    socket.emit(WS.COMBAT_INIT_STATE, {
      tokenId:   playerToken.id,
      position,
      weapon,
      fire_mode: fireMode,
    })
    setConfirmed(true)
  }

  if (confirmed) {
    const posLabel = STATE_DEFS.position.states.find(s => s.k === position)?.l  ?? position
    const wpnLabel = STATE_DEFS.weapon.states.find(s => s.k === weapon)?.l      ?? weapon
    const fmLabel  = STATE_DEFS.fire_mode.states.find(s => s.k === fireMode)?.l ?? fireMode
    return (
      <div style={{ ...S.window, left: pos.left, top: pos.top }}>
        <div style={S.confirmedTitle}>État initial confirmé ✓</div>
        <div style={S.confirmedRow}>{posLabel} · {wpnLabel} · {fmLabel}</div>
      </div>
    )
  }

  return (
    <div style={{ ...S.window, left: pos.left, top: pos.top }}>
      <div style={S.header} onMouseDown={onHeaderMouseDown}>ÉTAT INITIAL</div>
      <div style={S.chips}>
        <StateChip defKey="position"  current={position}  onChange={setPosition}  />
        <StateChip defKey="weapon"    current={weapon}    onChange={setWeapon}    />
        <StateChip defKey="fire_mode" current={fireMode}  onChange={setFireMode}  />
      </div>
      <button style={S.btnConfirm} onClick={handleConfirm}>Confirmer</button>
    </div>
  )
}

const S = {
  window: {
    position: 'absolute',
    width: 260,
    background: 'rgba(8,12,20,0.97)',
    border: '1.5px solid #15212e',
    borderRadius: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    pointerEvents: 'auto',
    padding: '12px',
    fontFamily: 'Inter, system-ui',
  },
  header: {
    fontSize: 9, letterSpacing: '0.15em', fontWeight: 700,
    color: '#3a8aaa', marginBottom: 10,
    cursor: 'grab', userSelect: 'none',
  },
  chips: {
    display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10,
  },
  chip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 10px',
    background: '#0a1018', border: '1px solid #1a2a38', borderRadius: 2,
    cursor: 'pointer', userSelect: 'none',
  },
  chipLabel: {
    fontSize: 8, color: '#456575', letterSpacing: '0.1em',
    fontFamily: 'monospace', minWidth: 72,
  },
  chipValue: {
    fontSize: 11, color: '#dde7ee', fontWeight: 600,
  },
  btnConfirm: {
    width: '100%', padding: '7px 0',
    background: 'rgba(80,200,120,0.12)', border: '1px solid #50c878',
    borderRadius: 3, color: '#50c878', fontSize: 11,
    fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
    fontFamily: 'monospace',
  },
  confirmedTitle: {
    fontSize: 11, color: '#50c878', fontWeight: 700, marginBottom: 4,
  },
  confirmedRow: {
    fontSize: 10, color: '#7a8a9a', fontFamily: 'monospace',
  },
}
