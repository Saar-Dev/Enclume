// GlossaryViewer.jsx — Contenu réel du glossaire (arbre livre → chapitre → article →
// sections), extrait de GlossaryPage.jsx le 2026-09-23 pour être réutilisable dans deux
// contextes :
//   - GlossaryPage.jsx (route standalone /encyclopedia/glossary, hors session)
//   - EncyclopediaViewer.jsx (fenêtre en jeu, mode `embedded` — pas de navigation de route,
//     une simple sélection de section)
//
// Chaque section appelle `onSelectSection(sectionId)` au clic au lieu d'un lien <a href>
// (GlossaryPage.jsx pointait vers /encyclopedia#id en dur — une vraie navigation, jamais
// acceptable depuis la fenêtre en jeu puisqu'elle démonterait la session).
//
// Chargement : loadGlossary() parcourt tous les articles en parallèle au montage. Coût
// unique par affichage, pas de cache persistant (rechargé à chaque ouverture).

import { useEffect, useState } from 'react'
import { loadGlossary } from './contentLoader.js'

export default function GlossaryViewer({ onSelectSection }) {
  const [glossary, setGlossary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadGlossary('fr')
      .then(g => { if (!cancelled) setGlossary(g) })
      .catch(err => { if (!cancelled) setError(err.message || 'Erreur de chargement') })
    return () => { cancelled = true }
  }, [])

  if (error) return <div className="encyclo-error">{error}</div>
  if (!glossary) return <div className="encyclo-loading">Chargement…</div>
  if (glossary.length === 0) return <div className="encyclo-empty">Aucune section ciblable.</div>

  return (
    <div className="encyclo-glossary-page-content">
      {glossary.map(book => (
        <section key={book.slug} className="encyclo-glossary-page-book">
          <h2 className="encyclo-glossary-page-book-title">{book.title}</h2>

          {book.chapters.map(chapter => (
            <div key={chapter.slug} className="encyclo-glossary-page-chapter">
              <h3 className="encyclo-glossary-page-chapter-title">{chapter.title}</h3>

              {chapter.articles.map(article => (
                <div key={article.id} className="encyclo-glossary-page-article">
                  <h4 className="encyclo-glossary-page-article-title">{article.title}</h4>
                  <ul className="encyclo-glossary-page-sections">
                    {article.sections.map(section => (
                      <li
                        key={section.id}
                        className={`encyclo-glossary-page-section encyclo-glossary-page-section-level-${section.level ?? 'callout'}`}
                      >
                        <button type="button" className="encyclo-glossary-page-section-btn" onClick={() => onSelectSection(section.id)}>
                          {section.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
