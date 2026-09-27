import { useState } from 'react'

// storageKey : ouvert/ferme memorise par section (retour Saar 2026-09-27) — sans cle, se comporte
// comme avant (etat interne initialise a defaultOpen, jamais persiste).
export default function FloatingPanelSection({ title, defaultOpen = false, storageKey = null, children }) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === '1') return true
      if (saved === '0') return false
    } catch {
      // localStorage indisponible : retombe sur defaultOpen.
    }
    return defaultOpen
  })

  const handleToggle = event => {
    const next = event.target.open
    setOpen(next)
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, next ? '1' : '0')
    } catch {
      // localStorage indisponible (quota, navigation privee) : l'etat reste valide en memoire.
    }
  }

  return (
    <details open={open} onToggle={handleToggle} style={S.section}>
      <summary style={S.summary}>{title}</summary>
      <div style={S.content}>{children}</div>
    </details>
  )
}

const S = {
  section: {
    border: '1px solid #27273a',
    borderRadius: '7px',
    background: 'rgba(15, 23, 42, 0.45)',
    overflow: 'hidden',
    // flexShrink: 0 — piège flexbox : un enfant `overflow != visible` dans un conteneur flex-column a
    // une taille minimale automatique de 0 (au lieu de sa taille de contenu), donc un parent
    // `overflow-y:auto` contraint en hauteur COMPRIME cette section au lieu de déborder et de
    // scroller (retour Saar 2026-09-18, EntityInstancePanel.jsx — aucune barre de défilement,
    // molette inopérante, alors que le contenu tenait "visuellement" en écrasant les lignes du bas).
    // Sans ce correctif, tout panneau flottant utilisant ce composant (SurfaceWallPanel.jsx,
    // SurfaceRoomPanel.jsx aussi) porte le même défaut latent.
    flexShrink: 0,
  },
  summary: {
    padding: '9px 10px',
    color: '#aebbd0',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    userSelect: 'none',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    padding: '2px 10px 10px',
  },
}
