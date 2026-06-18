import { useState } from 'react'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { ACTION_LABELS, PURE_MOVE_TYPES } from './combatSections.js'

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

// Corps du log uniquement — pas de titre. Chaque parent gère son titre.
export function DeclareLogContent({ maxHeight }) {
  const { announcedActions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  return (
    <div className="combat-declare-log-body" style={maxHeight ? { maxHeight } : undefined}>
      {announcedActions.length === 0 ? (
        <div className="combat-declare-log-empty">Aucune déclaration pour ce tour.</div>
      ) : (
        announcedActions.map((entry, i) => (
          <EntryLines key={`${entry.tokenId}-${i}`} entry={entry} tokens={tokens} />
        ))
      )}
    </div>
  )
}

export default function CombatDeclareLogSidebar() {
  const { currentTurn } = useCombatStore()
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="cdl-window">
      <div className="cdl-titlebar" onClick={() => setIsOpen(v => !v)}>
        <span className="cdl-title">Déclarations · Tour {currentTurn}</span>
        <span className="cdl-toggle">{isOpen ? '▼' : '▶'}</span>
      </div>
      <div className={`cdl-body${isOpen ? '' : ' cdl-body--hidden'}`}>
        <DeclareLogContent />
      </div>
    </div>
  )
}
