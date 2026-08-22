// Bouton (i) + panel flottant décrivant une compétence — extrait de SkillsPanel.jsx (comportement
// visuel inchangé), réutilisé par CareersAllocator.jsx (Step4 Profession, docs/EN_COURS.md).
// Composant "dumb" (état possédé par l'appelant, même patron que DiceBreakdownPopover.jsx/Sidebar.jsx) :
// chaque consommateur garde son propre useState(detailPanel)/useRef/effet clic-dehors — seuls le
// calcul de position, le bouton et le rendu du panel sont partagés ici.

const PANEL_WIDTH = 280
const PANEL_HEIGHT = 436

function openSkillInfoPanel(skill, e, setDetailPanel) {
  e.stopPropagation()
  const rect = e.currentTarget.getBoundingClientRect()
  const x = rect.right + 8 + PANEL_WIDTH > window.innerWidth - 16
    ? rect.left - 8 - PANEL_WIDTH
    : rect.right + 8
  const y = Math.min(rect.top, window.innerHeight - PANEL_HEIGHT)
  setDetailPanel({ skill, x, y })
}

export function SkillInfoButton({ skill, setDetailPanel }) {
  if (!skill?.description) return null
  return (
    <button style={s.infoBtn} onClick={(e) => openSkillInfoPanel(skill, e, setDetailPanel)}>ⓘ</button>
  )
}

// popover: { skill, x, y } | null — popoverRef: attaché par l'appelant à son effet clic-dehors.
// onClose: optionnel, affiche un bouton × en plus de la fermeture par clic-dehors déjà gérée par l'appelant.
export default function SkillInfoPopover({ popover, popoverRef, onClose }) {
  if (!popover) return null
  return (
    <div ref={popoverRef} style={{ ...s.detailPanel, top: popover.y, left: popover.x }}>
      <div style={s.detailHeader}>
        <span style={s.detailTitle}>{popover.skill.label}</span>
        {onClose && <button style={s.detailClose} onClick={onClose}>×</button>}
      </div>
      <div style={s.detailAttrs}>
        {popover.skill.attr_1}{popover.skill.attr_2 ? `/${popover.skill.attr_2}` : `/${popover.skill.attr_1}`}
        {popover.skill.marker && popover.skill.marker !== 'S' && (
          <span style={{ marginLeft: '6px', color: '#4a4a7a' }}>{popover.skill.marker}</span>
        )}
      </div>
      <p style={s.detailText}>{popover.skill.description}</p>
    </div>
  )
}

const s = {
  infoBtn: {
    background: 'none',
    border: 'none',
    color: '#3a3a6a',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  // position: fixed — eschappe overflow: hidden des conteneurs parents (CharacterWindow, wiz-shell).
  detailPanel: {
    position: 'fixed',
    width: `${PANEL_WIDTH}px`,
    maxHeight: '420px',
    display: 'flex',
    flexDirection: 'column',
    background: '#0e0e1a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    zIndex: 2000,
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px 6px',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  detailTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#c0c0d0',
  },
  detailClose: {
    background: 'none',
    border: 'none',
    color: '#4a4a6a',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: '0 2px',
  },
  detailAttrs: {
    padding: '4px 12px',
    fontSize: '10px',
    color: '#4a4a7a',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  detailText: {
    padding: '6px 12px 12px',
    fontSize: '11px',
    color: '#7a7a9a',
    lineHeight: '1.6',
    margin: 0,
    overflowY: 'auto',
    flex: 1,
  },
}
