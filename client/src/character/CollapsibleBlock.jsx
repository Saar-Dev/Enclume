// CollapsibleBlock.jsx — section repliable générique, extraite de CharacterSheet.jsx (dupliquée à
// l'identique dans ExoSheetWindow.jsx avant extraction — Règle 2, autorité unique). `open`/`onToggle`
// restent contrôlés par l'appelant (état + éventuelle persistance localStorage propres à chaque fiche,
// ex. CharacterSheet.jsx mémorise par type de fiche propriétaire/autres — pas le rôle de ce composant).
export default function CollapsibleBlock({ id, title, open, onToggle, children }) {
  return (
    <div style={s.block}>
      <div style={s.blockHeadRow} onClick={() => onToggle(id)}>
        <span style={s.blockTitle}>{title}</span>
        <span style={{ ...s.blockChevron, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
      </div>
      {open && children}
    </div>
  )
}

const s = {
  block: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  blockHeadRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    backgroundColor: '#0e0e1a',
    borderBottom: '1px solid #1e1e2e',
    cursor: 'pointer',
  },
  blockTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  blockChevron: {
    fontSize: '9px',
    color: '#6a6a88',
    transition: 'transform 0.15s ease',
  },
}
