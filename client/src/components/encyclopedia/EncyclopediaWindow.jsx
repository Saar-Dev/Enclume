// EncyclopediaWindow.jsx — Fenêtre Encyclopédie accessible en jeu (Sidebar > Outils).
//
// Version minimale (2026-09-23) : taille fixe à 80% de la zone playground (viewport moins
// la sidebar), centrée. Pas de barre de titre — ChapterList.jsx porte déjà « Encyclopédie »
// dans son propre en-tête, une deuxième aurait été redondante (retour Saar). Seul un ✕
// flottant en haut à droite pour fermer. Pas de drag/resize/réduction ici — prévu dans une
// passe ultérieure, une fois cette version testée en jeu réel (conception détaillée déjà
// faite, voir mémoire de session : redimensionnable + mémoire de taille/article jusqu'à
// fermeture + réduction en pastille par double-clic sur l'en-tête).
//
// Bornes : calculées par rapport à `sidebarWidth` (même valeur que CombatOverlay reçoit déjà
// de SessionPage pour ne jamais passer sous la sidebar), recalculées au redimensionnement du
// navigateur. La sidebar est ancrée à droite (voir CombatOverlay.jsx) — la fenêtre reste dans
// la zone de gauche.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EncyclopediaViewer from './EncyclopediaViewer.jsx'
import './encyclopedia.css'

const SIZE_RATIO = 0.8
const MIN_WIDTH = 600
const MIN_HEIGHT = 400

function computeBounds(sidebarWidth) {
  const playgroundWidth = Math.max(0, window.innerWidth - sidebarWidth)
  const width = Math.max(MIN_WIDTH, Math.min(playgroundWidth, playgroundWidth * SIZE_RATIO))
  const height = Math.max(MIN_HEIGHT, Math.min(window.innerHeight, window.innerHeight * SIZE_RATIO))
  const left = Math.max(0, (playgroundWidth - width) / 2)
  const top = Math.max(0, (window.innerHeight - height) / 2)
  return { width, height, left, top }
}

export default function EncyclopediaWindow({ sidebarWidth, onClose }) {
  const { t } = useTranslation()
  const [bounds, setBounds] = useState(() => computeBounds(sidebarWidth))

  useEffect(() => {
    setBounds(computeBounds(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    const onResize = () => setBounds(computeBounds(sidebarWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [sidebarWidth])

  return (
    <div
      className="encyclo-window"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
    >
      <button
        type="button"
        className="btn-icon encyclo-window-close"
        onClick={onClose}
        title={t('common.close')}
      >✕</button>
      <div
        className="encyclo-window-body"
        style={{ '--encyclo-scroll-height': `${bounds.height}px` }}
      >
        <EncyclopediaViewer embedded />
      </div>
    </div>
  )
}
