// client/src/components/InfoPopover.jsx
// Coquille générique « bouton (i) + panneau flottant ancré au clic », extraite de
// SkillInfoPopover.jsx (MARCHAND-UX-REVIEW, 2026-10-08) au moment d'ajouter un 3ᵉ consommateur
// (détail d'un objet d'inventaire) : plutôt qu'une 3ᵉ copie du même calcul de position et de la
// même structure de panneau, ce module porte la partie réellement identique (position, boîte,
// en-tête + fermeture, clic-dehors géré par l'appelant comme avant) ; chaque consommateur garde la
// forme de ses propres données et le contenu de son corps (`children`). SkillInfoPopover.jsx devient
// un habillage fin par-dessus, API externe inchangée — comportement identique pour ses deux
// consommateurs existants (SkillsPanel.jsx, CareersAllocator.jsx).
// Composant "dumb" (même patron que DiceBreakdownPopover.jsx/Sidebar.jsx) : l'état d'ouverture
// { data, x, y } et l'effet clic-dehors restent possédés par l'appelant.
// Le calcul de position (openInfoPanel) vit dans lib/infoPopover.js — un fichier qui exporte à la
// fois des composants et une fonction casse le Fast Refresh de Vite (react-refresh/only-export-components).

export function InfoButton({ onOpen, title }) {
  return (
    <button style={s.infoBtn} onClick={onOpen} title={title}>ⓘ</button>
  )
}

// panel: { data, x, y, width } | null — popoverRef : attaché par l'appelant à son effet clic-dehors.
// title/children : contenu du corps, calculé par l'appelant à partir de panel.data.
export default function InfoPopover({ panel, popoverRef, onClose, title, children }) {
  if (!panel) return null
  return (
    <div ref={popoverRef} style={{ ...s.detailPanel, top: panel.y, left: panel.x, width: panel.width }}>
      <div style={s.detailHeader}>
        <span style={s.detailTitle}>{title}</span>
        {onClose && <button style={s.detailClose} onClick={onClose}>×</button>}
      </div>
      {children}
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
}
