import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'

export default function CombatTimeline({ characters, topOffset = 0, onPortraitClick }) {
  const { roster, phase, activeTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  if (!phase || roster.length === 0) return null

  // LdB p.212 — ANNONCE : lents en premier (ASC) / RÉSOLUTION : rapides en premier (DESC)
  const sorted = [...roster].sort((a, b) =>
    phase === 'ANNOUNCEMENT' ? a.initiative - b.initiative : b.initiative - a.initiative
  )

  return (
    <div style={{ ...styles.bar, top: topOffset }}>
      {sorted.map(entry => {
        const token = tokens.find(t => t.id === entry.token_id)
        const char = token ? characters.find(c => c.id === token.character_id) : null
        const portraitUrl = char?.portrait_url ?? null  // PC20 : portrait_url nullable
        const isActive = entry.token_id === activeTokenId

        return (
          <div
            key={entry.id ?? entry.token_id}
            style={{
              ...styles.slot,
              ...(entry.has_announced ? styles.slotAnnounced : {}),
              ...(isActive ? styles.slotActive : {}),
              ...(onPortraitClick ? { cursor: 'pointer' } : {}),
            }}
            onClick={onPortraitClick}
          >
            {portraitUrl
              ? (
                <img
                  src={portraitUrl}
                  alt={token?.label}
                  style={styles.portrait}
                />
              )
              : (
                <div style={styles.portraitPlaceholder}>
                  {(token?.label ?? '?').charAt(0).toUpperCase()}
                </div>
              )
            }
            <div style={styles.info}>
              <span style={styles.label}>{token?.label ?? '?'}</span>
              <span style={styles.ini}>{entry.initiative}</span>
            </div>
            {entry.has_announced && <span style={styles.badge}>✓</span>}
            {entry.is_surprised && !entry.has_announced && (
              <span style={styles.surpriseBadge}>⚠</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    padding: '6px 12px',
    background: 'rgba(10,10,20,0.85)',
    borderBottom: '1px solid #2a2a3e',
    overflowX: 'auto',
    pointerEvents: 'auto',
  },
  slot: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    flexShrink: 0,
    position: 'relative',
  },
  slotAnnounced: {
    border: '1px solid #50c878',
    background: 'rgba(80,200,120,0.06)',
  },
  slotActive: {
    border: '2px solid #f5c542',
    background: 'rgba(245,197,66,0.10)',
  },
  portrait: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    objectFit: 'cover',
  },
  portraitPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#2a2a3e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: '#8888a8',
    fontWeight: 600,
    flexShrink: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  label: {
    fontSize: 11,
    color: '#c0c0d0',
    fontWeight: 500,
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ini: {
    fontSize: 11,
    color: '#5b8dee',
  },
  badge: {
    fontSize: 11,
    color: '#50c878',
    fontWeight: 700,
    marginLeft: 2,
  },
  surpriseBadge: {
    fontSize: 11,
    color: '#e0a050',
    marginLeft: 2,
  },
}
