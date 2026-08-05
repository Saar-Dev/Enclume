// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 2) — comportement inchangé.
// ─── Breakdown popover — détail des modificateurs d'un jet ──────────────────
const TYPE_COLOR = { base: '#5b8dee', bonus: '#4CAF77', malus: '#E05C5C', neutral: '#909099', total: '#c8a030' }

export default function DiceBreakdownPopover({ popover, popoverRef }) {
  if (!popover) return null
  const { rect, breakdown } = popover
  const spaceBelow = window.innerHeight - rect.bottom
  const top    = spaceBelow >= 260 ? rect.bottom + 6 : rect.top - 6
  const xform  = spaceBelow >= 260 ? 'none' : 'translateY(-100%)'
  const left   = Math.min(rect.left, window.innerWidth - 240)
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Détail du jet"
      style={{
        position: 'fixed', top, left, transform: xform,
        width: 230, background: '#0e1520',
        border: '1px solid rgba(91,141,238,0.3)',
        borderRadius: 6, padding: '8px 10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        zIndex: 9999, fontSize: 12, color: '#c0c0d0', userSelect: 'none',
      }}
    >
      {breakdown.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: entry.type === 'total' ? '5px 0 2px' : '2px 0',
          borderTop: entry.type === 'total' ? '1px solid rgba(200,160,48,0.25)' : 'none',
          marginTop: entry.type === 'total' ? 4 : 0,
        }}>
          <span style={{ color: entry.type === 'total' ? '#c8a030' : '#a0a8b8' }}>{entry.label}</span>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace", fontWeight: 700,
            color: TYPE_COLOR[entry.type] ?? '#c0c0d0',
          }}>
            {entry.type !== 'total' && entry.type !== 'base' && entry.value > 0 ? `+${entry.value}` : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}
