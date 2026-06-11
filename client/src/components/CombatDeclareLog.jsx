import { useState } from 'react'
import { useDraggable } from '../lib/useDraggable.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'

const ACTION_LABELS = {
  assault:    'Assaut (tir)',
  melee:      'Assaut (CaC)',
  reload:     'Rechargement',
  micro:      'Action',
  move_short: 'Déplacement',
  move_long:  'Déplacement (long)',
  sprint:     'Sprint',
  rush:       'Rush',
  move:       'Déplacement',
}

const PURE_MOVE_TYPES = new Set(['move_short', 'move_long', 'sprint', 'rush', 'move'])

function EntryLines({ entry, tokens }) {
  const tok    = tokens.find(t => t.id === entry.tokenId)
  const atkTok = entry.attackTargetId ? tokens.find(t => t.id === entry.attackTargetId) : null
  const isPureMove     = PURE_MOVE_TYPES.has(entry.actionType)
  const hasSeparateMove = entry.moveTarget && !isPureMove

  const actionLabel = ACTION_LABELS[entry.actionType] ?? (entry.actionType ?? '–')
  const moveDest = entry.moveTarget
    ? `[${entry.moveTarget.x ?? '?'}, ${entry.moveTarget.y ?? entry.moveTarget.z ?? '?'}]`
    : null

  return (
    <>
      {/* Header acteur */}
      <div className="combat-declare-log-actor">
        <span
          className="combat-declare-log-dot"
          style={{ background: tok?.color ?? '#5b8dee' }}
        />
        <span className="combat-declare-log-name">{tok?.label ?? '?'}</span>
        <span className="combat-declare-log-ini">INI {entry.initiative ?? '?'}</span>
      </div>

      {/* Ligne déplacement (si combiné avec une autre action) */}
      {hasSeparateMove && (
        <div className="combat-declare-log-line">
          <span className="combat-declare-log-icon">→</span>
          <span className="combat-declare-log-detail combat-declare-log-detail--move">
            Déplacement {moveDest}
          </span>
        </div>
      )}

      {/* Ligne action principale */}
      <div className="combat-declare-log-line">
        <span className="combat-declare-log-icon">
          {(entry.actionType === 'assault' || entry.actionType === 'melee') ? '⚡'
            : isPureMove ? '→'
            : entry.actionType === 'reload' ? '↺'
            : '◆'}
        </span>
        <span className={
          'combat-declare-log-detail' +
          (entry.actionType === 'assault' ? ' combat-declare-log-detail--atk' : '') +
          (entry.actionType === 'melee'   ? ' combat-declare-log-detail--melee' : '') +
          (isPureMove                     ? ' combat-declare-log-detail--move' : '')
        }>
          {actionLabel}
          {isPureMove && moveDest ? ` ${moveDest}` : ''}
          {atkTok ? ` → ${atkTok.label}` : ''}
        </span>
      </div>
    </>
  )
}

export default function CombatDeclareLog() {
  const { announcedActions, currentTurn } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [isOpen, setIsOpen] = useState(true)

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-declare-log-pos',
    { top: 80, left: Math.max(0, window.innerWidth - 290) },
    270
  )

  return (
    <div
      className="combat-float-win"
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: 270 }}
    >
      <div
        className="combat-float-header"
        onMouseDown={onHeaderMouseDown}
        style={{ justifyContent: 'space-between' }}
      >
        <span style={{ fontSize: 9, letterSpacing: '0.12em', fontWeight: 700, color: '#6080a0', textTransform: 'uppercase' }}>
          Déclarations · Tour {currentTurn}
        </span>
        <button
          onClick={() => setIsOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5b5b7a', fontSize: 10, padding: 0, lineHeight: 1 }}
        >
          {isOpen ? '▲' : '▼'}
        </button>
      </div>

      {isOpen && (
        <div className="combat-declare-log-body">
          {announcedActions.length === 0 ? (
            <div className="combat-declare-log-empty">Aucune déclaration pour ce tour.</div>
          ) : (
            announcedActions.map((entry, i) => (
              <EntryLines key={`${entry.tokenId}-${i}`} entry={entry} tokens={tokens} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
