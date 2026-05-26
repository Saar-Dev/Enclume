import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'

// ─── Constantes ────────────────────────────────────────────────────────────────
const DICE_TYPES = [
  { label: 'D4',   formula: 'd4'   },
  { label: 'D6',   formula: 'd6'   },
  { label: 'D8',   formula: 'd8'   },
  { label: 'D10',  formula: 'd10'  },
  { label: 'D12',  formula: 'd12'  },
  { label: 'D20',  formula: 'd20'  },
  { label: 'D100', formula: 'd100' },
]
const QUANTITIES = [2, 3, 4, 5, 6]

// Position initiale du panneau déplié — bas gauche, au-dessus du bouton replié
const INITIAL_POS = { x: 20, y: window.innerHeight - 520 }
// Dimensions du panneau pour le clamp (éviter sortie d'écran)
const PANEL_W = 320
const PANEL_H = 460

// ─── Icône dé SVG ──────────────────────────────────────────────────────────────
function DiceIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 145 145"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="m38.521 127.7c-17.051-9.4895-31.125-17.448-31.275-17.685-0.39725-0.62684-0.36252-72.805 0.035389-73.549 0.1752-0.32736 3.0912-2.1729 6.48-4.1011 11.408-6.4914 31.355-17.83 43.701-24.843 7.6986-4.3725 12.477-6.9063 12.844-6.8103 0.3215 0.084073 5.3886 2.888 11.26 6.231 5.8716 3.343 13.916 7.9184 17.876 10.168 26.868 15.26 32.543 18.516 33.04 18.956 0.52717 0.46668 0.56 2.6374 0.56 37.025 0 28.741-0.0853 36.637-0.4 37.033-0.50322 0.63428-61.544 34.567-62.452 34.717-0.42553 0.0704-11.921-6.1523-31.67-17.143zm48.519-9.8609c9.2826-12.082 16.843-21.996 16.8-22.032-0.19213-0.15988-67.15-0.85757-67.306-0.70132-0.09678 0.09678 6.9216 9.5858 15.596 21.087 8.6748 11.501 16.209 21.514 16.743 22.251 0.53364 0.7371 1.0422 1.3452 1.1302 1.3513 0.088 6e-3 7.7548-9.8741 17.037-21.956zm-24.78 18.065c-7.8385-10.474-29.603-39.269-30.002-39.693-0.51357-0.54572-0.98865-0.26516-10.025 5.92-5.2171 3.5711-9.4553 6.6008-9.4182 6.7328 0.05505 0.19624 49.72 28.014 50.105 28.065 0.06489 9e-3 -0.23225-0.45251-0.66032-1.0245zm38.223-11.965c12.54-6.9769 23.71-13.188 24.824-13.803 1.6449-0.908 1.9454-1.192 1.6-1.5122-0.52301-0.48483-18.401-11.999-18.631-11.999-0.0907 0-6.1724 7.812-13.515 17.36-7.3424 9.548-14.273 18.548-15.401 20-1.1284 1.452-1.9673 2.64-1.8642 2.64s10.447-5.7084 22.987-12.685zm28.642-62.04-0.0832-14.566-9.2625 22.479c-5.0944 12.363-9.2704 22.733-9.28 23.043-0.0123 0.3948 2.7642 2.3663 9.2625 6.5769l9.28 6.0131 0.0832-14.49c0.0458-7.9697 0.0458-21.045 0-29.056zm-108.75 36.978c4.9809-3.425 9.1248-6.4058 9.2086-6.6241 0.11235-0.29279-13.525-33.331-18.273-44.269-0.43965-1.0128-0.48738 1.6772-0.49871 28.107-0.0069 16.075 0.10429 29.179 0.24706 29.12 0.14277-0.0587 4.3349-2.9089 9.3158-6.3339zm83.808-7.1618c-0.14348-0.59495-33.986-59.072-34.183-59.067-0.088 0.0023-5.4092 8.9618-11.825 19.91-6.4157 10.948-14.102 24.051-17.081 29.118-2.9787 5.0669-5.3602 9.2681-5.2922 9.3362 0.06805 0.06805 15.17 0.32899 33.561 0.57987 18.39 0.25088 33.772 0.4776 34.181 0.50381 0.47544 0.03048 0.70616-0.10701 0.64-0.38138z"
        fill="currentColor"
      />
    </svg>
  )
}

// ─── Composant principal ────────────────────────────────────────────────────────
export default function DicePanel({ socket, mode, sidebarVisible, sidebarWidth }) {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState(INITIAL_POS)
  const [formula, setFormula] = useState('')

  // useRef pour l'état du drag — pas de re-render pendant le mouvement
  // seul setPos déclenche le re-render de positionnement
  const dragState = useRef(null)

  const isEditMode = mode === 'edit'

  // ─── Drag ──────────────────────────────────────────────────────────────────
  const handleDragMove = useCallback((e) => {
    if (!dragState.current) return
    const rawX = dragState.current.originX + (e.clientX - dragState.current.startX)
    const rawY = dragState.current.originY + (e.clientY - dragState.current.startY)
    // Clamp — panneau ne sort pas de l'écran
    setPos({
      x: Math.max(0, Math.min(rawX, window.innerWidth - PANEL_W)),
      y: Math.max(0, Math.min(rawY, window.innerHeight - PANEL_H)),
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    dragState.current = null
    document.removeEventListener('pointermove', handleDragMove)
    document.removeEventListener('pointerup', handleDragEnd)
  }, [handleDragMove])

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    }
    document.addEventListener('pointermove', handleDragMove)
    document.addEventListener('pointerup', handleDragEnd)
  }, [pos, handleDragMove, handleDragEnd])

  // Cleanup si le composant est démonté pendant un drag en cours
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handleDragMove)
      document.removeEventListener('pointerup', handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  // ─── Émission ─────────────────────────────────────────────────────────────
  const emitRoll = useCallback((f) => {
    if (!socket || !f.trim()) return
    socket.emit(WS.DICE_ROLL, { formula: f.trim() })
  }, [socket])

  const handleGridClick = useCallback((quantity, dieFormula) => {
    emitRoll(`${quantity}${dieFormula}`)
  }, [emitRoll])

  const handleAdvancedRoll = useCallback(() => {
    emitRoll(formula)
    setFormula('')
  }, [formula, emitRoll])

  const handleFormulaKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleAdvancedRoll()
  }, [handleAdvancedRoll])

  // ─── Rendu — bouton replié (toujours présent) ─────────────────────────────
  // Position dynamique — collé à la sidebar
  // right = largeur sidebar + 12px de marge si visible, sinon 12px
  // top = sous la barre GM (40px) + 8px marge = 48px
  const btnRight = (sidebarVisible && sidebarWidth) ? sidebarWidth + 12 : 12
  const toggleButton = (
    <button
      style={{
        ...styles.toggleBtn,
        right: `${btnRight}px`,
        top: '48px',
        ...(isEditMode ? styles.toggleBtnDisabled : {}),
      }}
      onClick={() => !isEditMode && setIsOpen(o => !o)}
      title={isEditMode ? '' : t('dice.panel')}
      aria-label={t('dice.panel')}
    >
      <DiceIcon size={26} />
    </button>
  )

  if (!isOpen) return toggleButton

  // ─── Rendu — panneau déplié ───────────────────────────────────────────────
  return (
    <>
      {toggleButton}

      <div
        style={{ ...styles.panel, left: pos.x, top: pos.y }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>{t('dice.panel')}</span>

          {/* Toggle "Jet au MJ" — désactivé, Étape D future */}
          <div style={styles.gmToggleWrapper} title={t('dice.gmRollSoon')}>
            <label style={styles.gmToggleLabel}>
              <input
                type="checkbox"
                disabled
                style={styles.gmToggleInput}
              />
              <span style={styles.gmToggleText}>{t('dice.gmRoll')}</span>
            </label>
          </div>

          <button
            style={styles.closeBtn}
            onClick={() => setIsOpen(false)}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* ── Grille ──────────────────────────────────────────────────── */}
        <div style={styles.gridWrapper}>
          <table style={styles.grid}>
            <thead>
              <tr>
                <th style={styles.thEmpty} />
                {QUANTITIES.map(q => (
                  <th key={q} style={styles.thQty}>{q}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DICE_TYPES.map(({ label, formula: dieFormula }) => (
                <tr key={dieFormula}>
                  <td style={styles.tdLabel}>
                    <button
                      style={styles.labelBtn}
                      onClick={() => emitRoll(dieFormula)}
                      title={`1${dieFormula}`}
                    >
                      {label}
                    </button>
                  </td>
                  {QUANTITIES.map(q => (
                    <td key={q} style={styles.tdCell}>
                      <button
                        style={styles.cellBtn}
                        onClick={() => handleGridClick(q, dieFormula)}
                        title={`${q}${dieFormula}`}
                      >
                        {q}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Séparateur ──────────────────────────────────────────────── */}
        <div style={styles.divider} />

        {/* ── Jet avancé ──────────────────────────────────────────────── */}
        <div style={styles.advancedRow}>
          <input
            style={styles.formulaInput}
            value={formula}
            onChange={e => setFormula(e.target.value)}
            onKeyDown={handleFormulaKeyDown}
            placeholder={t('dice.formula')}
            spellCheck={false}
          />
          <button
            style={{
              ...styles.rollBtn,
              ...(formula.trim() ? {} : styles.rollBtnDisabled),
            }}
            onClick={handleAdvancedRoll}
            disabled={!formula.trim()}
          >
            {t('dice.launch')}
          </button>
        </div>

        {/* ── Footer — handle drag ─────────────────────────────────────── */}
        <div style={styles.footer}>
          <button
            style={styles.dragHandle}
            onPointerDown={handleDragStart}
            aria-label={t('dice.move')}
          >
            ⠿ {t('dice.move')}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  // Bouton replié — flottant, collé à la sidebar (haut-droite du canvas)
  // La position right est calculée dynamiquement depuis les props sidebarVisible/sidebarWidth
  toggleBtn: {
    position: 'fixed',
    zIndex: 8000,
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#2a2a4a',
    border: '1px solid #3a3a5e',
    color: '#9090c0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  toggleBtnDisabled: {
    opacity: 0.3,
    pointerEvents: 'none',
    cursor: 'default',
  },

  // Panneau déplié
  panel: {
    position: 'fixed',
    zIndex: 8001,
    width: `${PANEL_W}px`,
    backgroundColor: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    userSelect: 'none',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: '1px solid #2a2a3e',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#c0c0d0',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flex: 1,
  },
  gmToggleWrapper: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  gmToggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'not-allowed',
  },
  gmToggleInput: {
    accentColor: '#5b8dee',
    cursor: 'not-allowed',
  },
  gmToggleText: {
    fontSize: '11px',
    color: '#8888a8',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#5a5a7a',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    lineHeight: 1,
    flexShrink: 0,
  },

  // Grille
  gridWrapper: {
    padding: '8px 12px',
    overflowX: 'auto',
  },
  grid: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  thEmpty: {
    width: '44px',
  },
  thQty: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#5a5a7a',
    textAlign: 'center',
    padding: '4px 2px',
    width: '40px',
  },
  tdLabel: {
    padding: '2px 4px 2px 0',
    whiteSpace: 'nowrap',
  },
  labelBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    fontWeight: '600',
    color: '#8888a8',
    fontFamily: 'monospace',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    width: '100%',
    textAlign: 'left',
  },
  tdCell: {
    padding: '2px',
    textAlign: 'center',
  },
  cellBtn: {
    width: '34px',
    height: '28px',
    background: 'none',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#9090b0',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },

  // Séparateur
  divider: {
    height: '1px',
    backgroundColor: '#2a2a3e',
    margin: '0 12px',
    flexShrink: 0,
  },

  // Jet avancé
  advancedRow: {
    display: 'flex',
    gap: '6px',
    padding: '10px 12px',
    flexShrink: 0,
  },
  formulaInput: {
    flex: 1,
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#c0c0d0',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  rollBtn: {
    backgroundColor: '#5b8dee',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  rollBtnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },

  // Footer drag
  footer: {
    padding: '6px 12px',
    borderTop: '1px solid #2a2a3e',
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dragHandle: {
    background: 'none',
    border: 'none',
    color: '#3a3a5a',
    fontSize: '11px',
    cursor: 'grab',
    padding: '2px 8px',
    borderRadius: '4px',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    letterSpacing: '0.03em',
  },
}
