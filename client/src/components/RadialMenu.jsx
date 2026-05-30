import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ─── RadialMenu ────────────────────────────────────────────────────────────────
// Menu radial SVG positionné en fixed sur le canvas.
// Affiché au clic sur l'icône ⚙ d'une entité (via onEntityClick dans SessionPage).
//
// Règles UX :
//   - 1 interaction  → pas de radial, action directe via onDirectAction
//   - 2-6 interactions → cercle SVG avec tranches égales
//   - Tranche GM "Modifier" toujours ajoutée pour le GM (en 7e position max)
//   - Fermeture : clic ailleurs, Échap, ou après action
//
// Props :
//   x, y          — coordonnées écran du clic (centre du menu)
//   interactions  — tableau d'interactions disponibles de l'entité
//   isGm          — boolean — ajoute la tranche "Modifier"
//   onAction      — callback(interaction) — déclenche l'action joueur
//   onGmConfig    — callback() — ouvre le panneau config GM
//   onDirectAction — callback(interaction) — action directe si 1 seule interaction
//   onClose       — fermeture

const RADIUS = 80        // rayon extérieur des tranches
const INNER_R = 28       // rayon du trou central
const LABEL_R = 58       // rayon du texte dans chaque tranche
const MENU_SIZE = 220    // viewBox et div size

const GM_SLICE = { id: '__gm_config__', action_label: 'Modifier' }

export default function RadialMenu({
  x, y,
  interactions = [],
  isGm = false,
  onAction,
  onMove,
  onGmConfig,
  onClose,
  actorToken = null,
  entity = null,
}) {
  const { t } = useTranslation()
  const menuRef = useRef(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [closing, setClosing] = useState(false)

  // Construire la liste des tranches
  const slices = [...interactions]
  if (isGm) slices.push(GM_SLICE)

  // Distance Tchebychev 2D acteur ↔ entité — pour grisage tranche displacement
  // pos_y base = profondeur (Z Three.js) — PE14
  const isOutOfRange = (slice) => {
    if (slice.move_type !== 'displacement') return false
    if (!actorToken || !entity) return false
    const dist = Math.max(
      Math.abs(entity.pos_x - actorToken.pos_x),
      Math.abs(entity.pos_y - actorToken.pos_y)
    )
    return dist > (slice.range ?? 1.5)
  }

  // Fermeture animée
  const close = () => {
    setClosing(true)
    setTimeout(onClose, 150)
  }

  // Fermeture sur clic extérieur et Échap
  useEffect(() => {
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Positionnement — éviter que le menu sorte de l'écran
  const size = MENU_SIZE
  const halfSize = size / 2
  const left = Math.max(8, Math.min(window.innerWidth - size - 8, x - halfSize))
  const top  = Math.max(8, Math.min(window.innerHeight - size - 8, y - halfSize))

  // ─── Calcul des chemins SVG ───────────────────────────────────────────────
  // Chaque tranche = arc SVG entre deux angles.
  // Angle 0 = droite (est), sens horaire.
  // On démarre à -90° pour que la première tranche soit en haut.
  const count = slices.length
  const angleStep = (2 * Math.PI) / count
  const startOffset = -Math.PI / 2  // démarre à midi

  const cx = halfSize
  const cy = halfSize

  const polar = (r, angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })

  const slicePath = (i) => {
    const a1 = startOffset + i * angleStep
    const a2 = startOffset + (i + 1) * angleStep
    const gap = 0.025  // espace entre tranches (radians)
    const a1g = a1 + gap
    const a2g = a2 - gap

    const outer1 = polar(RADIUS, a1g)
    const outer2 = polar(RADIUS, a2g)
    const inner1 = polar(INNER_R, a1g)
    const inner2 = polar(INNER_R, a2g)

    const largeArc = angleStep > Math.PI ? 1 : 0

    return [
      `M ${inner1.x} ${inner1.y}`,
      `L ${outer1.x} ${outer1.y}`,
      `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${outer2.x} ${outer2.y}`,
      `L ${inner2.x} ${inner2.y}`,
      `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${inner1.x} ${inner1.y}`,
      'Z',
    ].join(' ')
  }

  const labelPos = (i) => {
    const angle = startOffset + (i + 0.5) * angleStep
    return polar(LABEL_R, angle)
  }

  // Tronquer le label à 10 caractères
  const truncate = (s, n = 10) => s.length > n ? s.slice(0, n - 1) + '…' : s

  const handleSliceClick = (slice) => {
    if (isOutOfRange(slice)) return
    if (slice.id === GM_SLICE.id) {
      close()
      onGmConfig?.()
    } else if (slice.move_type === 'displacement') {
      close()
      onMove?.(slice)
    } else {
      close()
      onAction?.(slice)
    }
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left,
        top,
        width: size,
        height: size,
        zIndex: 10000,
        pointerEvents: 'auto',
        animation: closing
          ? 'radialClose 0.15s ease-in forwards'
          : 'radialOpen 0.18s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
    >
      <style>{`
        @keyframes radialOpen {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes radialClose {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.6); }
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* ── Ombre portée ── */}
        <defs>
          <filter id="radial-shadow">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.6" />
          </filter>
          <filter id="radial-glow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#5b8dee" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* ── Tranches ── */}
        <g filter="url(#radial-shadow)">
          {slices.map((slice, i) => {
            const isGmSlice = slice.id === GM_SLICE.id
            const isHovered = hoveredIdx === i
            const outOfRange = isOutOfRange(slice)
            const baseColor = isGmSlice ? '#2a1a3e' : outOfRange ? '#111118' : '#0e0e1a'
            const hoverColor = isGmSlice ? '#4a2060' : outOfRange ? '#111118' : '#1a2040'
            const strokeColor = isGmSlice
              ? (isHovered ? '#a855f7' : '#5a3a7a')
              : outOfRange
                ? '#1e1e28'
                : (isHovered ? '#5b8dee' : '#1e2a3e')

            return (
              <path
                key={slice.id}
                d={slicePath(i)}
                fill={isHovered ? hoverColor : baseColor}
                stroke={strokeColor}
                strokeWidth={isHovered ? '1.5' : '1'}
                style={{
                  cursor: outOfRange ? 'not-allowed' : 'pointer',
                  transition: 'fill 0.12s, stroke 0.12s',
                  filter: isHovered && !outOfRange ? 'url(#radial-glow)' : 'none',
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => handleSliceClick(slice)}
              />
            )
          })}
        </g>

        {/* ── Labels texte ── */}
        {slices.map((slice, i) => {
          const isGmSlice = slice.id === GM_SLICE.id
          const isHovered = hoveredIdx === i
          const outOfRange = isOutOfRange(slice)
          const pos = labelPos(i)
          const color = isGmSlice
            ? (isHovered ? '#c084fc' : '#a855f7')
            : outOfRange
              ? '#2a2a3a'
              : (isHovered ? '#93b4f5' : '#8898b8')

          return (
            <text
              key={`label-${slice.id}`}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fontFamily="'SF Mono', 'Fira Code', monospace"
              letterSpacing="0.04em"
              fontWeight={isHovered ? '600' : '400'}
              fill={color}
              style={{
                pointerEvents: 'none',
                transition: 'fill 0.12s, font-weight 0.12s',
                textTransform: 'uppercase',
              }}
            >
              {truncate(slice.id === '__gm_config__' ? t('radialMenu.gmModify') : slice.action_label, 9)}
            </text>
          )
        })}

        {/* ── Centre — bouton fermeture ── */}
        <circle
          cx={cx}
          cy={cy}
          r={INNER_R - 2}
          fill="#0a0a14"
          stroke="#1e2a3e"
          strokeWidth="1"
          style={{ cursor: 'pointer' }}
          onClick={close}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="14"
          fill="#2a3a52"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          ✕
        </text>
      </svg>
    </div>
  )
}
