import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// Couleurs de sévérité — cohérentes avec shared/woundConstants.js et le design system
const SEV = {
  legere:   '#FFD700',
  moyenne:  '#FFA500',
  grave:    '#FF6B6B',
  critique: '#FF0000',
  mortelle: '#8B0000',
}

const ACCENT     = '#46c6e6'
const ACCENT_DIM = `${ACCENT}40`

// ─── Helpers géométrie SVG ───────────────────────────────────────────────────
// Origine centrée en (CX, CY). Angle 0 = haut (nord), sens horaire.
const CX = 185, CY = 185

function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}
function P(r, d) { return polar(r, d).map(n => n.toFixed(1)).join(',') }

function arcSector(r1, r2, a0, a1) {
  const lg = (a1 - a0) > 180 ? 1 : 0
  return `M${P(r2,a0)} A${r2},${r2} 0 ${lg} 1 ${P(r2,a1)} L${P(r1,a1)} A${r1},${r1} 0 ${lg} 0 ${P(r1,a0)} Z`
}

function arcPath(r, a0, a1) {
  const lg = (a1 - a0) > 180 ? 1 : 0
  return `M${P(r,a0)} A${r},${r} 0 ${lg} 1 ${P(r,a1)}`
}

// ─── Flèche directionnelle ────────────────────────────────────────────────────
// r = orientation (0=nord, 2=est, 4=sud, 6=ouest). active = mode direction en cours.
// Dessinée dans les coords SVG du cœur (CX, CY comme origine).
function DirectionArrow({ r, active }) {
  const angle = r * Math.PI / 4
  const fwdX = Math.sin(angle), fwdY = -Math.cos(angle)
  const perpX = Math.cos(angle), perpY = Math.sin(angle)
  const len = 26, hs = 4, al = 7
  const tipX = (CX + fwdX * len).toFixed(1)
  const tipY = (CY + fwdY * len).toFixed(1)
  // Base de la tête de flèche (triangle)
  const b1x = (CX + fwdX * (len - al) + perpX * hs).toFixed(1)
  const b1y = (CY + fwdY * (len - al) + perpY * hs).toFixed(1)
  const b2x = (CX + fwdX * (len - al) - perpX * hs).toFixed(1)
  const b2y = (CY + fwdY * (len - al) - perpY * hs).toFixed(1)
  const color = active ? ACCENT : `${ACCENT}55`
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line x1={CX} y1={CY} x2={tipX} y2={tipY}
            stroke={color} strokeWidth={active ? 1.5 : 1}
            strokeLinecap="round"
            style={{ filter: active ? `drop-shadow(0 0 4px ${ACCENT}88)` : 'none' }} />
      <polygon points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`} fill={color} />
    </g>
  )
}

// ─── Constantes menu ─────────────────────────────────────────────────────────
const R1  = 80   // rayon intérieur des secteurs
const R2  = 170  // rayon extérieur des secteurs
const RW  = 64   // rayon de l'anneau de blessures
const N   = 8    // nombre de secteurs
const GAP = 5    // écart entre secteurs en degrés
const SIZE = 370

// ─── TokenRadialMenu ─────────────────────────────────────────────────────────
// Menu radial hard-SF. Cœur = boussole directionnelle (hover zone 15–42px du centre).
// Sprint 1 : Fiche ✅ + Retirer ✅ fonctionnels. 6 autres = placeholders visuels.
//
// Props :
//   x, y                 — coordonnées écran (clientX/clientY du clic)
//   token                — objet token (id, character_id, r)
//   character            — objet character (worst_wound_severity, user_id, id)
//   isGm                 — boolean
//   onOpenCharacterSheet — callback() → ouvre CharacterWindow
//   onRemoveToken        — callback() → supprime le token (doClose gère la fermeture)
//   onSetRotation        — callback(r: 0..7) → oriente le token
//   onViser              — callback() → active le mode LOS (ligne de vue)
//   onClose              — callback() → démonte le composant

export default function TokenRadialMenu({
  x, y,
  token,
  character,
  isGm,
  onOpenCharacterSheet,
  onRemoveToken,
  onSetRotation,
  onOpenStatusPanel,
  onViser,
  onOpenExchange,
  onClose,
}) {
  const { t } = useTranslation()
  const menuRef = useRef(null)
  const [hover,    setHover]    = useState(null)
  const [open,     setOpen]     = useState(false)
  const [closing,  setClosing]  = useState(false)
  const [mousePos, setMousePos] = useState(null)  // coords dans l'espace SVG

  // Animation d'entrée — bloom staggeré
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Fermeture sur clic extérieur ou Échap
  useEffect(() => {
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) doClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') doClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const doClose = () => {
    setClosing(true)
    setTimeout(onClose, 150)
  }

  // ─── Suivi souris pour la boussole ───────────────────────────────────────
  const handleMouseMove = (e) => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  const handleMouseLeave = () => setMousePos(null)

  // Calcul de la direction active : zone annulaire 15–42 px du centre
  const dirInfo = useMemo(() => {
    if (!mousePos) return null
    const dx = mousePos.x - CX
    const dy = mousePos.y - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 15 || dist > 42) return null
    const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)
    const r = Math.round(angle / (Math.PI / 4)) % 8
    return { r }
  }, [mousePos])

  // Clic sur le cœur : direction si en zone, fermeture si zone morte
  const handleCenterClick = (e) => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const dx = e.clientX - rect.left - CX
    const dy = e.clientY - rect.top - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist >= 15) {
      const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)
      const r = Math.round(angle / (Math.PI / 4)) % 8
      onSetRotation?.(r)
    }
    doClose()
  }

  const worst    = character?.worst_wound_severity ?? null
  const severe   = worst === 'critique' || worst === 'mortelle'
  const orbColor = worst ? SEV[worst] : '#1a2540'

  // Définition des secteurs — Sprint 1 : fiche + retirer actifs
  const actions = [
    { id: 'fiche',     label: t('tokenRadial.fiche'),     enabled: true  },
    { id: 'jet',       label: t('tokenRadial.jet'),       enabled: false },
    { id: 'recharger', label: t('tokenRadial.recharger'), enabled: false },
    { id: 'deplacer',  label: t('tokenRadial.deplacer'),  enabled: false },
    { id: 'retirer',   label: t('tokenRadial.retirer'),   enabled: true  },
    { id: 'echange',   label: t('tokenRadial.echange'),   enabled: !isGm },
    { id: 'viser',     label: t('tokenRadial.viser'),     enabled: true  },
    { id: 'statuts',   label: t('tokenRadial.statuts'),   enabled: true  },
  ]

  const handleSliceClick = (a) => {
    if (!a.enabled) return
    if (a.id === 'fiche')   { doClose(); onOpenCharacterSheet?.() }
    if (a.id === 'retirer') { doClose(); onRemoveToken?.() }
    if (a.id === 'statuts') { doClose(); onOpenStatusPanel?.() }
    if (a.id === 'viser')   { doClose(); onViser?.() }
    if (a.id === 'echange') { doClose(); onOpenExchange?.() }
  }

  // ─── Secteurs ─────────────────────────────────────────────────────────────
  const wedges = actions.map((a, i) => {
    const seg   = 360 / N
    const a0    = i * seg + GAP / 2
    const a1    = (i + 1) * seg - GAP / 2
    const mid   = i * seg + seg / 2
    const isHot = hover === a.id && a.enabled
    const [lx, ly] = polar((R1 + R2) / 2, mid)
    const fill   = isHot ? `${ACCENT}24` : 'rgba(11,17,25,0.40)'
    const stroke = isHot ? ACCENT : a.enabled ? ACCENT_DIM : '#18202c'
    const textFill = isHot ? '#eafaff' : a.enabled ? '#a4cdda' : '#334455'
    return (
      <g
        key={a.id}
        onMouseEnter={() => a.enabled && setHover(a.id)}
        onMouseLeave={() => setHover(h => h === a.id ? null : h)}
        onClick={() => handleSliceClick(a)}
        style={{
          cursor: a.enabled ? 'pointer' : 'default',
          transformOrigin: `${CX}px ${CY}px`,
          transform:  open ? 'scale(1)' : 'scale(.82)',
          opacity:    open ? 1 : 0,
          transition: `transform .34s cubic-bezier(.18,.9,.2,1.05) ${i * 0.028}s, opacity .26s ease ${i * 0.028}s`,
        }}
      >
        <path d={arcSector(R1, R2, a0, a1)} fill={fill} stroke={stroke}
              strokeWidth={isHot ? 1.8 : 1}
              style={{ transition: 'fill .12s, stroke .12s',
                       filter: isHot ? `drop-shadow(0 0 8px ${ACCENT}bb)` : 'none' }} />
        <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10.5" fontWeight="600"
              letterSpacing="1.5" fill={textFill}
              style={{ textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
          {a.label}
        </text>
      </g>
    )
  })

  // ─── Graduations de bord ──────────────────────────────────────────────────
  const ticks = actions.map((_, i) => {
    const ang = i * (360 / N)
    const [x1, y1] = polar(R2,     ang)
    const [x2, y2] = polar(R2 + 5, ang)
    return (
      <line key={`tk${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={ACCENT_DIM} strokeWidth="1"
            style={{ opacity: open ? 0.7 : 0, transition: `opacity .3s ease ${.2 + i * .02}s` }} />
    )
  })

  // ─── Anneau de blessures — Sprint 1 simplifié ────────────────────────────
  const woundEls = useMemo(() => {
    const span = 270, start = -135
    const slotSize = span / 6, g = 2.6
    return (
      <g>
        <path d={arcPath(RW, start, start + span)}
              stroke="#1a232e" strokeWidth="7" fill="none" strokeLinecap="round" />
        {worst && (
          <path d={arcPath(RW, start + g / 2, start + slotSize - g / 2)}
                stroke={SEV[worst]} strokeWidth="6.5" fill="none" strokeLinecap="round"
                style={{ opacity: open ? 1 : 0, transition: 'opacity .3s ease .34s' }} />
        )}
      </g>
    )
  }, [worst, open])

  const hotAction = actions.find(a => a.id === hover)

  // ─── Positionnement — clamping écran ─────────────────────────────────────
  const half = SIZE / 2
  const left = Math.max(8, Math.min(window.innerWidth  - SIZE - 8, x - half))
  const top  = Math.max(8, Math.min(window.innerHeight - SIZE - 8, y - half))

  return (
    <div
      ref={menuRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        left, top,
        width: SIZE, height: SIZE,
        zIndex: 10000,
        pointerEvents: 'auto',
        opacity:    closing ? 0 : 1,
        transform:  closing ? 'scale(0.82)' : 'scale(1)',
        transition: closing ? 'opacity .15s ease, transform .15s ease' : 'none',
      }}
    >
      <style>{`
        @keyframes trm-danger {
          0%, 100% { opacity: .15; transform: scale(1); }
          50%       { opacity: .5;  transform: scale(1.12); }
        }
      `}</style>

      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
           style={{ display: 'block' }}>
        {/* Halo ambiant */}
        <circle cx={CX} cy={CY} r={R2} fill={ACCENT} fillOpacity=".035" />
        {ticks}
        {wedges}
        {/* Séparateur intérieur */}
        <circle cx={CX} cy={CY} r={R1 - 4} fill="none" stroke={ACCENT_DIM}
                strokeWidth="1" strokeDasharray="2 4" opacity=".5" />

        {/* Groupe cœur — animation bloom */}
        <g style={{
          transformOrigin: `${CX}px ${CY}px`,
          transform:  open ? 'scale(1)' : 'scale(.4)',
          opacity:    open ? 1 : 0,
          transition: 'transform .3s cubic-bezier(.2,.9,.2,1.1), opacity .2s',
        }}>
          {severe && (
            <circle cx={CX} cy={CY} r={52} fill="none" stroke={orbColor} strokeWidth="3"
                    style={{ transformOrigin: `${CX}px ${CY}px`,
                             animation: 'trm-danger 1.6s ease-in-out infinite' }} />
          )}
          {woundEls}
          <circle cx={CX} cy={CY} r={51} fill="none" stroke={ACCENT}
                  strokeWidth="1" strokeOpacity=".22" />
          <circle cx={CX} cy={CY} r={45} fill={orbColor} />
          <circle cx={CX} cy={CY} r={45} fill="none" stroke="#05070b" strokeWidth="2.5" />

          {/* Contenu cœur : label secteur survolé OU boussole directionnelle */}
          {hotAction ? (
            <text x={CX} y={CY + 2} textAnchor="middle" fontSize="10" fontWeight="700"
                  letterSpacing="1.5" fill="#fff" fillOpacity=".92"
                  style={{ textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
              {hotAction.label}
            </text>
          ) : (
            <DirectionArrow r={dirInfo?.r ?? token?.r ?? 0} active={!!dirInfo} />
          )}

          {/* Zone de clic cœur — ferme OU oriente selon la position */}
          <circle cx={CX} cy={CY} r={42} fill="transparent"
                  style={{ cursor: dirInfo ? 'crosshair' : 'pointer' }}
                  onClick={handleCenterClick} />
        </g>
      </svg>
    </div>
  )
}
