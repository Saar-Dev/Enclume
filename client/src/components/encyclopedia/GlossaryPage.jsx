// GlossaryPage.jsx — Page dédiée au glossaire de l'Encyclopédie (route standalone).
//
// Habillage (titre + retour) autour du contenu réel (GlossaryViewer.jsx, extrait 2026-09-23
// pour être aussi montable dans EncyclopediaViewer.jsx en mode embedded — fenêtre en jeu).
//
// Route : /encyclopedia/glossary — protégée, comme l'Encyclopédie.
//
// Le clic sur une section navigue en SPA vers /encyclopedia#id (pas un <a href> en dur comme
// avant 2026-09-23) : EncyclopediaViewer résout désormais ce hash au montage pour sélectionner
// le bon article — un vrai bug corrigé au passage, pas juste un changement de goût. Avant, le
// hash restait inerte (l'Encyclopédie ouvrait toujours son premier article par défaut) et
// ArticleView cherchait l'ancre dans le mauvais article sans jamais la trouver.

import { useNavigate } from 'react-router-dom'
import GlossaryViewer from './GlossaryViewer.jsx'
import './encyclopedia.css'

export default function GlossaryPage() {
  const navigate = useNavigate()

  return (
    <div className="app-shell encyclo-viewer">
      <div className="encyclo-glossary-page">
        <header className="encyclo-glossary-page-header">
          <h1 className="encyclo-glossary-page-title">Glossaire</h1>
          <button type="button" className="encyclo-glossary-page-back" onClick={() => navigate('/encyclopedia')}>
            ← Retour à l'Encyclopédie
          </button>
        </header>

        <GlossaryViewer onSelectSection={(id) => navigate(`/encyclopedia#${id}`)} />
      </div>
    </div>
  )
}