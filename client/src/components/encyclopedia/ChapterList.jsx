// ChapterList.jsx — Colonne de navigation de l'Encyclopédie.
//
// Accordéon 3 niveaux : Livre → Chapitre → Article.
// Composant contrôlé par le parent pour la sélection (chapitre + article actifs) ;
// l'état "livre ouvert/fermé" est local (useState).
//
// Comportement :
//   - seul le livre contenant le chapitre actif est ouvert par défaut
//   - les articles du chapitre actif sont visibles, les autres non
//   - clic sur chapitre → onSelectChapter(bookSlug, chapterSlug)
//     (le parent sélectionne le premier article du chapitre)
//   - clic sur article → onSelectArticle(bookSlug, chapterSlug, articleSlug)
//
// Le lien « Glossaire » en haut ouvre la page dédiée /encyclopedia/glossary.
//
// i18n : namespace 'encyclopedia' (voir locales/encyclopedia.json).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function ChapterList({
  index,
  activeBookSlug,
  activeChapterSlug,
  activeArticleSlug,
  onSelectChapter,
  onSelectArticle,
}) {
  const { t } = useTranslation('encyclopedia')

  const [openBooks, setOpenBooks] = useState(() => {
    return activeBookSlug ? new Set([activeBookSlug]) : new Set()
  })

  const toggleBook = (slug) => {
    setOpenBooks(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  return (
    <aside className="encyclo-nav">
      <div className="encyclo-nav-header">
        <span className="encyclo-nav-title">{t('nav.title')}</span>
        <Link to="/encyclopedia/glossary" className="encyclo-nav-glossary-link">
          Glossaire
        </Link>
      </div>

      <nav className="encyclo-nav-tree">
        {index.books.map(book => {
          const isOpen = openBooks.has(book.slug)
          return (
            <div key={book.slug} className="encyclo-nav-book-group">
              <button
                type="button"
                className="encyclo-nav-book"
                onClick={() => toggleBook(book.slug)}
                aria-expanded={isOpen}
              >
                <span className="encyclo-nav-caret">{isOpen ? '▾' : '▸'}</span>
                <span>{book.title}</span>
              </button>

              {isOpen && (
                <div className="encyclo-nav-book-chapters">
                  {book.chapters.map(chapter => {
                    const isChapterActive = chapter.slug === activeChapterSlug
                    return (
                      <div key={chapter.slug}>
                        <button
                          type="button"
                          className={`encyclo-nav-chapter${isChapterActive ? ' is-active' : ''}`}
                          onClick={() => onSelectChapter(book.slug, chapter.slug)}
                        >
                          {chapter.title}
                        </button>

                        {isChapterActive && chapter.articles.length > 0 && (
                          <div className="encyclo-nav-chapter-articles">
                            {chapter.articles.map((article, i) => {
                              const isArticleActive = article.slug === activeArticleSlug
                              const prevGroup = i > 0 ? chapter.articles[i - 1].group : undefined
                              const showGroupDivider = article.group && article.group !== prevGroup
                              return (
                                <div key={article.id}>
                                  {showGroupDivider && (
                                    <div className="encyclo-nav-group-divider">{article.group}</div>
                                  )}
                                  <button
                                    type="button"
                                    className={`encyclo-nav-article${isArticleActive ? ' is-active' : ''}`}
                                    onClick={() => onSelectArticle(book.slug, chapter.slug, article.slug)}
                                  >
                                    {article.title}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}