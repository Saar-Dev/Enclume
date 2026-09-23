// EncyclopediaPage.jsx — Page racine de l'Encyclopédie (route standalone /encyclopedia).
//
// Habillage plein écran autour du contenu réel (EncyclopediaViewer.jsx, extrait 2026-09-23
// pour être aussi montable dans EncyclopediaWindow.jsx, la fenêtre en jeu).
//
// CSS : import direct, scopé au domaine encyclopedia.

import EncyclopediaViewer from './EncyclopediaViewer.jsx'
import './encyclopedia.css'

export default function EncyclopediaPage() {
  return (
    <div className="app-shell encyclo-viewer">
      <EncyclopediaViewer />
    </div>
  )
}
