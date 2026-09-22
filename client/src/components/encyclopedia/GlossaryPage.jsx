// GlossaryPage.jsx — Page dédiée au glossaire de l'Encyclopédie.
//
// Affiche l'arbre des sections ciblables, groupé par livre → chapitre →
// article → sections. Chaque section est un lien vers l'article correspondant
// avec son ancre, ce qui déclenche le scroll automatique dans ArticleView.
//
// Route : /encyclopedia/glossary — protégée, comme l'Encyclopédie.
//
// Chargement : loadGlossary() parcourt tous les articles en parallèle au
// montage. Coût unique par visite, pas de cache persistant (rechargé à
// chaque ouverture).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadGlossary } from './contentLoader.js'
import './encyclopedia.css'

export default function GlossaryPage() {
  const [glossary, setGlossary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadGlossary('fr')
      .then(g => { if (!cancelled) setGlossary(g) })
      .catch(err => { if (!cancelled) setError(err.message || 'Erreur de chargement') })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="app-shell encyclo-viewer">
      <div className="encyclo-glossary-page">
        <header className="encyclo-glossary-page-header">
          <h1 className="encyclo-glossary-page-title">Glossaire</h1>
          <Link to="/encyclopedia" className="encyclo-glossary-page-back">
            ← Retour à l'Encyclopédie
          </Link>
        </header>

        {error && <div className="encyclo-error">{error}</div>}

        {!error && !glossary && (
          <div className="encyclo-loading">Chargement…</div>
        )}

        {!error && glossary && glossary.length === 0 && (
          <div className="encyclo-empty">Aucune section ciblable.</div>
        )}

        {!error && glossary && glossary.length > 0 && (
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
                              <a href={`/encyclopedia#${section.id}`}>{section.title}</a>
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
        )}
      </div>
    </div>
  )
}