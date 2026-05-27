import { useState, useRef, useCallback, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useAuthStore } from '../stores/authStore.js'

// ─── Constantes layout ──────────────────────────────────────────────────────
const WHEEL_SIZE  = 240
const RING_RADIUS = 80
const CENTER_SIZE = 78
const RING_SIZE   = 60

const PANEL_W = 340
const PANEL_H = 600

const INITIAL_POS = { x: 20, y: Math.max(20, window.innerHeight - PANEL_H - 20) }

// Couronne : d10 en haut (angle 0°), sens horaire
const RING = [
  { k: 'd10',  angle:   0 },
  { k: 'd100', angle:  60 },
  { k: 'd12',  angle: 120 },
  { k: 'd8',   angle: 180 },
  { k: 'd6',   angle: 240 },
  { k: 'd4',   angle: 300 },
]

// ─── Helpers formule ────────────────────────────────────────────────────────
// formula = { k: 'd20'|null, n: 0, mod: 0 }

const isEmpty = f => !f || !f.k || f.n === 0

function formulaDisplay(f) {
  if (isEmpty(f)) return ''
  let s = `${f.n}${f.k.toUpperCase()}`
  if (f.mod > 0) s += ` + ${f.mod}`
  if (f.mod < 0) s += ` − ${Math.abs(f.mod)}`
  return s
}

// Format envoyé au serveur — compatible regex parseDice : /^(\d+)?d(\d+)([+-]\d+)?$/i
function buildEmitFormula(f) {
  if (isEmpty(f)) return null
  const base = f.n === 1 ? f.k : `${f.n}${f.k}`
  if (f.mod > 0) return `${base}+${f.mod}`
  if (f.mod < 0) return `${base}${f.mod}`
  return base
}

const emptyFormula = () => ({ k: null, n: 0, mod: 0 })

// ─── PCBBackground ──────────────────────────────────────────────────────────
function PCBBackground({ size, color }) {
  const w = size, h = size
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.28 }}>
      <defs>
        <pattern id="pcb-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.6" fill={color} opacity="0.5"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width={w} height={h} fill="url(#pcb-grid)"/>
      <g stroke={color} strokeWidth="0.7" fill="none" strokeLinejoin="miter" strokeLinecap="square">
        <path d="M 10 30 L 60 30 L 60 50 L 90 50 L 90 20 L 180 20 L 180 60 L 220 60 L 220 35 L 270 35"/>
        <path d="M 0 120 L 40 120 L 40 100 L 100 100 L 100 130 L 160 130 L 160 110 L 220 110 L 220 150"/>
        <path d="M 20 220 L 70 220 L 70 200 L 130 200 L 130 230 L 190 230 L 190 195 L 250 195 L 250 240"/>
        <path d="M 50 5 L 50 60 L 30 60 L 30 90"/>
        <path d="M 200 5 L 200 35 L 230 35 L 230 90 L 210 90 L 210 130"/>
        <path d="M 130 240 L 130 180 L 110 180 L 110 150"/>
        <path d="M 270 130 L 270 180 L 245 180 L 245 220"/>
      </g>
      <g fill={color}>
        {[[60,30],[90,50],[180,20],[220,60],[40,100],[100,130],[160,110],[220,110],
          [70,200],[130,200],[190,230],[250,195],[50,60],[30,60],[200,35],[230,35],[110,180],[245,180]]
          .map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.4"/>)}
      </g>
      <g stroke={color} strokeWidth="0.7" fill="none">
        <rect x="120" y="60" width="28" height="14"/>
        <rect x="40" y="160" width="18" height="22"/>
        <rect x="205" y="165" width="14" height="18"/>
      </g>
    </svg>
  )
}

// ─── DieShape ───────────────────────────────────────────────────────────────
function DieShape({ k, size = 64, isCenter = false, count = 0, color = '#3a8aaa', hovered = false }) {
  const s = size, cx = s / 2, cy = s / 2
  const active = count > 0

  let fillOpacity = 0
  if (active && hovered)  fillOpacity = 0.40
  else if (active)        fillOpacity = 0.22
  else if (hovered)       fillOpacity = 0.14
  if (isCenter && !active && !hovered) fillOpacity = 0.06

  const stroke      = active || hovered ? color : (isCenter ? color + 'cc' : '#5a7080')
  const strokeWidth = isCenter ? 2 : (hovered || active ? 1.8 : 1.4)
  const txtFill     = (active || hovered) ? color : (isCenter ? color : '#5a7080')

  const txt = (label, fs = 0.30) => (
    <text x={cx} y={cy + s * 0.13} textAnchor="middle"
      fontFamily="'Share Tech Mono', monospace" fontSize={s * fs}
      fill={txtFill} fontWeight="600"
      style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {label}
    </text>
  )

  let shape
  if (k === 'd20') {
    const r = s * 0.46
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 - 90) * Math.PI / 180
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    }).join(' ')
    shape = <polygon points={pts} fill={color} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth}/>
  } else if (k === 'd10' || k === 'd100') {
    const r = s * 0.44
    shape = <polygon
      points={`${cx},${cy - r} ${cx + r * 0.85},${cy} ${cx},${cy + r} ${cx - r * 0.85},${cy}`}
      fill={color} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth}/>
  } else if (k === 'd6') {
    const r = s * 0.42
    shape = <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2}
      fill={color} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth}/>
  } else if (k === 'd4') {
    const r = s * 0.5
    shape = <polygon
      points={`${cx},${cy - r} ${cx + r * 0.866},${cy + r * 0.5} ${cx - r * 0.866},${cy + r * 0.5}`}
      fill={color} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth}/>
  } else if (k === 'd8') {
    const r = s * 0.46
    shape = <polygon
      points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      fill={color} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth}/>
  } else if (k === 'd12') {
    const r = s * 0.45
    const pts = Array.from({ length: 5 }, (_, i) => {
      const a = (i * 72 - 90) * Math.PI / 180
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    }).join(' ')
    shape = <polygon points={pts} fill={color} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth}/>
  }

  const label = () => {
    if (k === 'd10')  return txt('10', 0.26)
    if (k === 'd100') return txt('%', 0.26)
    if (k === 'd6')   return txt('6', 0.30)
    if (k === 'd8')   return txt('8', 0.28)
    if (k === 'd12')  return txt('12', 0.26)
    if (k === 'd20')  return txt('20', 0.28)
    if (k === 'd4') return (
      <text x={cx} y={cy + s * 0.28} textAnchor="middle"
        fontFamily="'Share Tech Mono', monospace" fontSize={s * 0.24} fill={txtFill}
        fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>4</text>
    )
    return null
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      style={{
        overflow: 'visible',
        filter: hovered ? `drop-shadow(0 0 6px ${color}99)` : (active ? `drop-shadow(0 0 3px ${color}66)` : 'none'),
        transition: 'filter 0.15s',
      }}>
      {shape}
      {label()}
    </svg>
  )
}

// ─── DieButton ──────────────────────────────────────────────────────────────
function DieButton({ k, count, color, size = 64, isCenter = false, onClick, onContextMenu }) {
  const [hovered, setHovered] = useState(false)
  const hitSize = size + 6
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Gauche : +1 ${k.toUpperCase()}  ·  Droit : −1`}
      style={{
        width: hitSize, height: hitSize,
        margin: -3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative',
        background: 'transparent', border: 'none',
        userSelect: 'none',
      }}
    >
      <DieShape k={k} size={size} isCenter={isCenter} count={count} color={color} hovered={hovered}/>
      {count > 0 && (
        <div style={{
          position: 'absolute',
          top: isCenter ? 4 : 2,
          right: isCenter ? 4 : 2,
          minWidth: 18, height: 18, padding: '0 4px',
          background: color, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 6px rgba(0,0,0,0.6), 0 0 0 2px #0a0d14`,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 10, color: '#06080e', fontWeight: 700,
          }}>{count}</span>
        </div>
      )}
    </div>
  )
}

// ─── Icône toggle bouton ─────────────────────────────────────────────────────
function DiceIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 145 145" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="m38.521 127.7c-17.051-9.4895-31.125-17.448-31.275-17.685-0.39725-0.62684-0.36252-72.805 0.035389-73.549 0.1752-0.32736 3.0912-2.1729 6.48-4.1011 11.408-6.4914 31.355-17.83 43.701-24.843 7.6986-4.3725 12.477-6.9063 12.844-6.8103 0.3215 0.084073 5.3886 2.888 11.26 6.231 5.8716 3.343 13.916 7.9184 17.876 10.168 26.868 15.26 32.543 18.516 33.04 18.956 0.52717 0.46668 0.56 2.6374 0.56 37.025 0 28.741-0.0853 36.637-0.4 37.033-0.50322 0.63428-61.544 34.567-62.452 34.717-0.42553 0.0704-11.921-6.1523-31.67-17.143zm48.519-9.8609c9.2826-12.082 16.843-21.996 16.8-22.032-0.19213-0.15988-67.15-0.85757-67.306-0.70132-0.09678 0.09678 6.9216 9.5858 15.596 21.087 8.6748 11.501 16.209 21.514 16.743 22.251 0.53364 0.7371 1.0422 1.3452 1.1302 1.3513 0.088 6e-3 7.7548-9.8741 17.037-21.956zm-24.78 18.065c-7.8385-10.474-29.603-39.269-30.002-39.693-0.51357-0.54572-0.98865-0.26516-10.025 5.92-5.2171 3.5711-9.4553 6.6008-9.4182 6.7328 0.05505 0.19624 49.72 28.014 50.105 28.065 0.06489 9e-3 -0.23225-0.45251-0.66032-1.0245zm38.223-11.965c12.54-6.9769 23.71-13.188 24.824-13.803 1.6449-0.908 1.9454-1.192 1.6-1.5122-0.52301-0.48483-18.401-11.999-18.631-11.999-0.0907 0-6.1724 7.812-13.515 17.36-7.3424 9.548-14.273 18.548-15.401 20-1.1284 1.452-1.9673 2.64-1.8642 2.64s10.447-5.7084 22.987-12.685zm28.642-62.04-0.0832-14.566-9.2625 22.479c-5.0944 12.363-9.2704 22.733-9.28 23.043-0.0123 0.3948 2.7642 2.3663 9.2625 6.5769l9.28 6.0131 0.0832-14.49c0.0458-7.9697 0.0458-21.045 0-29.056zm-108.75 36.978c4.9809-3.425 9.1248-6.4058 9.2086-6.6241 0.11235-0.29279-13.525-33.331-18.273-44.269-0.43965-1.0128-0.48738 1.6772-0.49871 28.107-0.0069 16.075 0.10429 29.179 0.24706 29.12 0.14277-0.0587 4.3349-2.9089 9.3158-6.3339zm83.808-7.1618c-0.14348-0.59495-33.986-59.072-34.183-59.067-0.088 0.0023-5.4092 8.9618-11.825 19.91-6.4157 10.948-14.102 24.051-17.081 29.118-2.9787 5.0669-5.3602 9.2681-5.2922 9.3362 0.06805 0.06805 15.17 0.32899 33.561 0.57987 18.39 0.25088 33.772 0.4776 34.181 0.50381 0.47544 0.03048 0.70616-0.10701 0.64-0.38138z"
        fill="currentColor"
      />
    </svg>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function DicePanel({ socket, mode, sidebarVisible, sidebarWidth }) {
  const { user } = useAuthStore()
  const playerColor = user?.color || '#3a8aaa'
  const isEditMode  = mode === 'edit'

  // ── State ──────────────────────────────────────────────────────────────────
  const [isOpen,      setIsOpen]  = useState(false)
  const [pos,         setPos]     = useState(INITIAL_POS)
  const [formula,     setFormula] = useState(emptyFormula())
  const [presets,     setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dice-presets') || '[]') }
    catch { return [] }
  })
  const [history,     setHistory] = useState([])
  const [secret,      setSecret]  = useState(false)
  const [editPresets, setEdit]    = useState(false)
  const [showHistory, setHist]    = useState(false)

  const dragState = useRef(null)

  // ── Persist presets ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('dice-presets', JSON.stringify(presets))
  }, [presets])

  // ── Historique local — écoute DICE_RESULT filtré sur userId ───────────────
  // P3 : socket dans le dep array
  useEffect(() => {
    if (!socket) return
    const handleResult = (data) => {
      if (data.userId !== user?.id) return
      setHistory(h => [{
        id:      data.timestamp,
        formula: data.formula,
        result:  data.total,
        rolls:   data.rolls,
        ts:      new Date(data.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        secret:  data.secret || false,
        crit:    data.isCriticalSuccess,
        fumble:  data.isCriticalFail,
      }, ...h].slice(0, 10))
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id])

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handleDragMove = useCallback((e) => {
    if (!dragState.current) return
    const rawX = dragState.current.originX + (e.clientX - dragState.current.startX)
    const rawY = dragState.current.originY + (e.clientY - dragState.current.startY)
    setPos({
      x: Math.max(0, Math.min(rawX, window.innerWidth  - PANEL_W)),
      y: Math.max(0, Math.min(rawY, window.innerHeight - PANEL_H)),
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    dragState.current = null
    document.removeEventListener('pointermove', handleDragMove)
    document.removeEventListener('pointerup',   handleDragEnd)
  }, [handleDragMove])

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
    document.addEventListener('pointermove', handleDragMove)
    document.addEventListener('pointerup',   handleDragEnd)
  }, [pos, handleDragMove, handleDragEnd])

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handleDragMove)
      document.removeEventListener('pointerup',   handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  // ── Dés ────────────────────────────────────────────────────────────────────
  // Clic gauche : même type → n++  |  nouveau type → switch (garde mod)
  const addDie = useCallback((k) => {
    setFormula(f => {
      if (f.k === k) return { ...f, n: f.n + 1 }
      return { k, n: 1, mod: f.mod }
    })
  }, [])

  // Clic droit : décrémente (e.preventDefault() pour supprimer le menu navigateur)
  const removeDie = useCallback((k, e) => {
    e?.preventDefault?.()
    setFormula(f => {
      if (f.k !== k) return f
      const newN = f.n - 1
      return newN <= 0 ? { ...f, k: null, n: 0 } : { ...f, n: newN }
    })
  }, [])

  const setMod = useCallback((v) => {
    setFormula(f => ({ ...f, mod: Math.max(-99, Math.min(99, v)) }))
  }, [])

  const clearFormula = useCallback(() => setFormula(emptyFormula()), [])

  const getCount = (k) => formula.k === k ? formula.n : 0

  // ── Émission — P3 : socket dans deps ──────────────────────────────────────
  const emitRoll = useCallback((formulaStr) => {
    if (!socket || !formulaStr) return
    socket.emit(WS.DICE_ROLL, { formula: formulaStr, secret })
  }, [socket, secret])

  const rollCurrent = useCallback(() => {
    emitRoll(buildEmitFormula(formula))
  }, [emitRoll, formula])

  const rollPreset = useCallback((p) => {
    emitRoll(buildEmitFormula(p.formula))
  }, [emitRoll])

  const loadPreset = useCallback((p) => {
    setFormula({ ...p.formula })
  }, [])

  const reroll = useCallback((formulaStr) => {
    emitRoll(formulaStr)
  }, [emitRoll])

  // ── Favoris ────────────────────────────────────────────────────────────────
  const savePreset = useCallback(() => {
    if (isEmpty(formula)) return
    const label = prompt('Nom du favori :', formulaDisplay(formula))
    if (!label) return
    setPresets(p => [...p, { id: 'p' + Date.now(), label, formula: { ...formula } }])
  }, [formula])

  const deletePreset = useCallback((id) => {
    setPresets(p => p.filter(x => x.id !== id))
  }, [])

  // ── Toggle button (toujours présent) ──────────────────────────────────────
  const btnRight = (sidebarVisible && sidebarWidth) ? sidebarWidth + 12 : 12
  const toggleButton = (
    <button
      style={{
        ...styles.toggleBtn,
        right: `${btnRight}px`,
        top: '48px',
        color: playerColor,
        borderColor: playerColor + '44',
        ...(isEditMode ? styles.toggleBtnDisabled : {}),
      }}
      onClick={() => !isEditMode && setIsOpen(o => !o)}
      title={isEditMode ? '' : 'Lanceur de dés'}
      aria-label="Lanceur de dés"
    >
      <DiceIcon size={26}/>
    </button>
  )

  // Panel fermé : on rend uniquement le toggle
  // Les hooks ci-dessus restent actifs (composant monté dans SessionPage)
  if (!isOpen) return toggleButton

  // ── Panel ──────────────────────────────────────────────────────────────────
  const cx = WHEEL_SIZE / 2
  const cy = WHEEL_SIZE / 2

  return (
    <>
      {toggleButton}
      <div
        style={{ ...styles.panel, left: pos.x, top: pos.y }}
        onPointerDown={e => e.stopPropagation()}
      >

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <span style={{ ...styles.monoSm, color: playerColor, letterSpacing: '0.18em', fontWeight: 600, flex: 1, fontSize: 11 }}>
            LANCEUR DE DÉS
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={secret}
              onChange={e => setSecret(e.target.checked)}
              style={{ accentColor: '#aa6030', cursor: 'pointer' }}
            />
            <span style={{ ...styles.monoSm, fontSize: 8, color: secret ? '#e8c870' : '#456575', letterSpacing: '0.08em' }}>
              JET AU MJ
            </span>
          </label>
          <span
            onClick={() => setIsOpen(false)}
            style={{ ...styles.monoSm, fontSize: 14, color: '#456575', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          >
            ✕
          </span>
        </div>

        {/* ── ROUE ───────────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE }}>

            {/* Fond PCB ambiance SF */}
            <PCBBackground size={WHEEL_SIZE} color={playerColor}/>

            {/* Cercle pointillé connecteur */}
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={WHEEL_SIZE} height={WHEEL_SIZE}>
              <circle cx={cx} cy={cy} r={RING_RADIUS}
                fill="none" stroke={playerColor + '22'} strokeWidth="1" strokeDasharray="2 4"/>
            </svg>

            {/* Dés couronne */}
            {RING.map(d => {
              const a = (d.angle - 90) * Math.PI / 180
              const x = cx + RING_RADIUS * Math.cos(a)
              const y = cy + RING_RADIUS * Math.sin(a)
              return (
                <div key={d.k} style={{
                  position: 'absolute',
                  left: x - RING_SIZE / 2,
                  top:  y - RING_SIZE / 2,
                  width: RING_SIZE, height: RING_SIZE,
                }}>
                  <DieButton
                    k={d.k} count={getCount(d.k)} color={playerColor} size={RING_SIZE}
                    onClick={() => addDie(d.k)}
                    onContextMenu={(e) => removeDie(d.k, e)}
                  />
                </div>
              )
            })}

            {/* D20 central */}
            <div style={{
              position: 'absolute',
              left: cx - CENTER_SIZE / 2,
              top:  cy - CENTER_SIZE / 2,
              width: CENTER_SIZE, height: CENTER_SIZE,
            }}>
              <DieButton
                k="d20" count={getCount('d20')} color={playerColor}
                size={CENTER_SIZE} isCenter
                onClick={() => addDie('d20')}
                onContextMenu={(e) => removeDie('d20', e)}
              />
            </div>
          </div>
        </div>

        {/* ── MOD + RESET ────────────────────────────────────────────────── */}
        <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...styles.monoSm, fontSize: 9, color: '#456575', letterSpacing: '0.1em' }}>MOD</span>

          <div onClick={() => setMod(formula.mod - 1)} style={styles.modBtn}>
            <span style={styles.modBtnTxt}>−</span>
          </div>
          <input
            type="number"
            value={formula.mod}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              setMod(isNaN(v) ? 0 : v)
            }}
            style={styles.modInput}
          />
          <div onClick={() => setMod(formula.mod + 1)} style={styles.modBtn}>
            <span style={styles.modBtnTxt}>+</span>
          </div>

          <div style={{ flex: 1 }}/>

          {!isEmpty(formula) && (
            <div
              onClick={clearFormula}
              style={styles.resetBtn}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#aa3030' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#aa303055' }}
            >
              <span style={{ ...styles.monoSm, fontSize: 9, color: '#e89090', letterSpacing: '0.08em', fontWeight: 600 }}>
                ↺ RESET
              </span>
            </div>
          )}
        </div>

        {/* ── FORMULE + LANCER ───────────────────────────────────────────── */}
        <div style={styles.formulaBar}>
          <div style={{
            flex: 1,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 14, fontWeight: 600, letterSpacing: '0.05em',
            color: isEmpty(formula) ? '#3a4a55' : '#dde7ee',
          }}>
            {isEmpty(formula) ? 'choisis un dé…' : formulaDisplay(formula)}
          </div>
          <div
            onClick={rollCurrent}
            style={{
              padding: '8px 16px',
              background: isEmpty(formula)
                ? '#1a1a1a'
                : `linear-gradient(180deg, ${playerColor}66 0%, ${playerColor}33 100%)`,
              border: `1px solid ${isEmpty(formula) ? '#15212e' : playerColor}`,
              cursor: isEmpty(formula) ? 'not-allowed' : 'pointer',
              opacity: isEmpty(formula) ? 0.5 : 1,
              transition: 'all 0.12s',
              userSelect: 'none',
            }}
          >
            <span style={{ ...styles.monoSm, fontSize: 11, color: '#aaccdd', fontWeight: 600, letterSpacing: '0.14em' }}>
              LANCER
            </span>
          </div>
        </div>

        {/* ── ENREGISTRER (contextuel) ───────────────────────────────────── */}
        {!isEmpty(formula) && (
          <div
            onClick={savePreset}
            style={styles.saveBtn}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.75' }}
          >
            <span style={{ fontFamily: 'Caveat, cursive', fontSize: 12, color: playerColor }}>
              + Enregistrer comme favori
            </span>
          </div>
        )}

        {/* ── FAVORIS ────────────────────────────────────────────────────── */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #15212e' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ ...styles.monoSm, fontSize: 8, color: '#aa8a30', letterSpacing: '0.12em', fontWeight: 600 }}>FAVORIS</span>
            <span style={{ fontFamily: 'Caveat, cursive', fontSize: 10, color: '#456575' }}>— clic = lance · ⇧clic = charge</span>
            <div style={{ flex: 1 }}/>
            {presets.length > 0 && (
              <span
                onClick={() => setEdit(v => !v)}
                style={{ ...styles.monoSm, fontSize: 8, color: editPresets ? '#e8c870' : '#456575', cursor: 'pointer', letterSpacing: '0.08em', userSelect: 'none' }}
              >
                {editPresets ? '✓ OK' : '✎ ÉDITER'}
              </span>
            )}
          </div>

          {presets.length === 0 && (
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 11, color: '#3a4a55', textAlign: 'center', padding: '4px 0' }}>
              aucun favori — lance un dé puis enregistre
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {presets.map(p => (
              <div
                key={p.id}
                onClick={(e) => {
                  if (editPresets) return
                  if (e.shiftKey) loadPreset(p)
                  else rollPreset(p)
                }}
                title={`${p.label} : ${formulaDisplay(p.formula)}`}
                style={styles.presetChip}
                onMouseEnter={e => { if (!editPresets) e.currentTarget.style.borderColor = playerColor }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#15212e' }}
              >
                <span style={{ fontSize: 10, color: '#dde7ee', fontFamily: 'Inter, system-ui, sans-serif' }}>{p.label}</span>
                <span style={{ ...styles.monoSm, fontSize: 8, color: '#456575' }}>{formulaDisplay(p.formula)}</span>
                {editPresets && (
                  <span
                    onClick={(e) => { e.stopPropagation(); deletePreset(p.id) }}
                    style={{ color: '#aa3030', fontSize: 11, marginLeft: 2, cursor: 'pointer', lineHeight: 1 }}
                  >
                    ✕
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── HISTORIQUE ─────────────────────────────────────────────────── */}
        <div>
          <div
            onClick={() => setHist(v => !v)}
            style={{
              padding: '7px 14px', background: '#06080e',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer',
              borderBottom: showHistory ? '1px solid #15212e' : 'none',
              userSelect: 'none',
            }}
          >
            <span style={{ ...styles.monoSm, fontSize: 8, color: '#5a7080', letterSpacing: '0.12em', fontWeight: 600 }}>
              HISTORIQUE
            </span>
            <span style={{ fontFamily: 'Caveat, cursive', fontSize: 10, color: '#3a4a55' }}>
              ({history.length}) — aussi dans le chat
            </span>
            <div style={{ flex: 1 }}/>
            <span style={{ ...styles.monoSm, fontSize: 10, color: '#5a7080' }}>
              {showHistory ? '▴' : '▾'}
            </span>
          </div>

          {showHistory && (
            <div style={{ padding: '4px 14px 8px', maxHeight: 140, overflowY: 'auto' }}>
              {history.length === 0 ? (
                <div style={{ fontFamily: 'Caveat, cursive', fontSize: 11, color: '#3a4a55', textAlign: 'center', padding: 8 }}>
                  aucun jet pour le moment
                </div>
              ) : history.map(h => {
                const accent = h.crit ? '#3aaa6a' : (h.fumble ? '#aa3030' : '#7a8a99')
                return (
                  <div
                    key={h.id}
                    onClick={() => reroll(h.formula)}
                    title="Clic : rejouer ce jet"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderBottom: '1px solid #0e1520', opacity: h.secret ? 0.55 : 1, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#0a1018' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ ...styles.monoSm, fontSize: 8, color: '#3a4a55', width: 36, flexShrink: 0 }}>{h.ts}</span>
                    <span style={{ ...styles.monoSm, fontSize: 10, color: '#7a8a99', flex: 1 }}>{h.formula}</span>
                    <span style={{ ...styles.monoSm, fontSize: 8, color: '#3a4a55' }}>[{h.rolls.join(',')}]</span>
                    <span style={{ ...styles.monoSm, fontSize: 14, color: accent, fontWeight: 700, minWidth: 26, textAlign: 'right' }}>{h.result}</span>
                    {h.secret && <span style={{ fontSize: 9 }} title="Jet au MJ">🔒</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER — drag handle ────────────────────────────────────────── */}
        <div style={styles.footer}>
          <button style={styles.dragHandle} onPointerDown={handleDragStart} aria-label="Déplacer le panneau">
            ≡ Déplacer
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  monoSm: {
    fontFamily: "'Share Tech Mono', monospace",
  },

  toggleBtn: {
    position: 'fixed',
    zIndex: 8000,
    width: '44px', height: '44px',
    borderRadius: '10px',
    backgroundColor: '#0a0d14',
    border: '1.5px solid #3a8aaa44',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    transition: 'border-color 0.15s',
  },
  toggleBtnDisabled: {
    opacity: 0.3,
    pointerEvents: 'none',
    cursor: 'default',
  },

  panel: {
    position: 'fixed',
    zIndex: 8001,
    width: `${PANEL_W}px`,
    background: '#0a0d14',
    border: '1.5px solid #15212e',
    boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    userSelect: 'none',
  },

  header: {
    padding: '10px 14px',
    background: '#06080e',
    borderBottom: '1.5px solid #15212e',
    display: 'flex', alignItems: 'center', gap: 8,
    flexShrink: 0,
  },

  modBtn: {
    width: 24, height: 24,
    background: '#0a1018', border: '1px solid #15212e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', borderRadius: 0, flexShrink: 0,
    userSelect: 'none',
  },
  modBtnTxt: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 13, color: '#7a8a99', lineHeight: 1,
  },
  modInput: {
    width: 46,
    padding: '4px 6px', textAlign: 'center',
    background: '#0a1018', border: '1px solid #15212e',
    borderRadius: 0,
    color: '#dde7ee',
    fontFamily: "'Share Tech Mono', monospace", fontSize: 12,
    outline: 'none',
    // Chrome spinner removal — handled via CSS if needed
  },
  resetBtn: {
    padding: '4px 9px',
    background: '#1a0a0a', border: '1px solid #aa303055',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    userSelect: 'none', transition: 'border-color 0.12s',
  },

  formulaBar: {
    padding: '8px 14px',
    borderTop: '1px solid #15212e', borderBottom: '1px solid #15212e',
    background: '#040608',
    display: 'flex', alignItems: 'center', gap: 8,
    flexShrink: 0,
  },

  saveBtn: {
    padding: '4px 14px', textAlign: 'right', cursor: 'pointer',
    background: '#0a0d14', borderBottom: '1px solid #15212e',
    opacity: 0.75, transition: 'opacity 0.12s',
    flexShrink: 0,
    userSelect: 'none',
  },

  presetChip: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 8px',
    background: '#0a1018', border: '1px solid #15212e',
    cursor: 'pointer', transition: 'border-color 0.1s',
    userSelect: 'none',
  },

  footer: {
    padding: '6px 14px',
    background: '#06080e',
    borderTop: '1px solid #15212e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  dragHandle: {
    background: 'none', border: 'none',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9, color: '#3a4a55',
    cursor: 'grab', padding: '2px 8px',
    userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: 4,
    letterSpacing: '0.08em',
  },
}
