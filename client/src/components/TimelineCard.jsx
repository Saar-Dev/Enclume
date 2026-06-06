import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'

const VITE_API_URL = import.meta.env.VITE_API_URL

export default function TimelineCard({
  portraitUrl,
  label,
  initiative,
  isActive,
  hasAnnounced,
  isSurprised,
  worstSeverity,
  isPnj = false,
  isDimmed = false,
  onClick,
}) {
  const imgSrc = portraitUrl ? `${VITE_API_URL}/api/assets/${portraitUrl}` : null
  const borderColor = worstSeverity ? SEVERITY_COLORS[worstSeverity] : 'rgba(255,255,255,0.12)'
  const w = isActive ? 72 : 54
  const h = isActive ? 100 : 76

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: w,
        height: h,
        borderRadius: 6,
        overflow: 'hidden',
        border: `2px solid ${borderColor}`,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.3s ease, opacity 0.3s ease',
        boxShadow: isActive ? 'var(--halo-active)' : 'none',
        opacity: isDimmed ? 0.35 : 1,
      }}
    >
      {/* Portrait plein format */}
      {imgSrc
        ? <img
            src={imgSrc}
            alt={label}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        : <div style={{
            position: 'absolute', inset: 0,
            background: isPnj
              ? 'linear-gradient(160deg, #2e1a1a, #4e2a2a)'
              : 'linear-gradient(160deg, #1a1a2e, #2a2a4e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isActive ? 26 : 20,
            color: isPnj ? '#aa5555' : '#5555aa',
            fontWeight: 700,
            userSelect: 'none',
          }}>
            {(label ?? '?').charAt(0).toUpperCase()}
          </div>
      }

      {/* Gradient bas — nom + INI */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
        padding: '16px 4px 4px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
      }}>
        <span style={{
          fontSize: 9,
          color: isActive ? 'var(--color-gold)' : '#e0e0f0',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: w - 8,
          lineHeight: 1.2,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          transition: 'color 0.2s ease',
        }}>
          {label ?? '?'}
        </span>
        <span style={{
          fontSize: 8,
          color: 'var(--color-primary)',
          fontWeight: 600,
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
        }}>
          {initiative}
        </span>
      </div>

      {/* Badge annoncé */}
      {hasAnnounced && (
        <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 10, color: 'var(--color-success-soft)', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          ✓
        </span>
      )}
      {/* Badge surpris */}
      {isSurprised && !hasAnnounced && (
        <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 10, color: 'var(--color-warning-soft)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          ⚠
        </span>
      )}
    </div>
  )
}
