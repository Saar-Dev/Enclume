// EncyclopediaPage.jsx — Page racine de l'Encyclopédie.
//
// Structure : trois niveaux de sélection (livre / chapitre / article).
// L'article est chargé à chaque changement d'article — c'est la seule unité de
// contenu, il n'y a plus de meta de chapitre séparée (citation/texte de cadrage
// d'un chapitre = article normal `<chapitre>.introduction`, en première position
// dans la nav — supprimé 2026-09-23 le double affichage chapitre+premier article).
//
// Au clic sur un chapitre, sélectionne automatiquement son premier article
// (l'introduction).
//
// i18n : namespace 'encyclopedia' (voir locales/encyclopedia.json).
// CSS : import direct, scopé au domaine encyclopedia.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getIndex, loadArticle, resolveWikiTarget } from './contentLoader.js'
import ChapterList from './ChapterList.jsx'
import ArticleView from './ArticleView.jsx'
import './encyclopedia.css'

// Sélectionne le premier chapitre non vide de l'index, avec son premier article.
function pickDefaultSelection(index) {
  for (const book of index.books) {
    for (const chapter of book.chapters) {
      if (chapter.articles.length > 0) {
        return {
          bookSlug: book.slug,
          chapterSlug: chapter.slug,
          articleSlug: chapter.articles[0].slug,
        }
      }
    }
  }
  return null
}

export default function EncyclopediaPage() {
  const { t } = useTranslation('encyclopedia')

  const index = useMemo(() => getIndex('fr'), [])
  const defaultSelection = useMemo(() => pickDefaultSelection(index), [index])

  const [activeBookSlug, setActiveBookSlug] = useState(defaultSelection?.bookSlug ?? null)
  const [activeChapterSlug, setActiveChapterSlug] = useState(defaultSelection?.chapterSlug ?? null)
  const [activeArticleSlug, setActiveArticleSlug] = useState(defaultSelection?.articleSlug ?? null)

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Charge l'article quand l'article change
  useEffect(() => {
    if (!activeBookSlug || !activeChapterSlug || !activeArticleSlug) {
      setArticle(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    loadArticle('fr', activeBookSlug, activeChapterSlug, activeArticleSlug)
      .then(content => {
        if (cancelled) return
        setArticle(content)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || t('states.errorGeneric'))
        setArticle(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [activeBookSlug, activeChapterSlug, activeArticleSlug, t])

  const handleSelectChapter = (bookSlug, chapterSlug) => {
    // Sélectionne automatiquement le premier article du chapitre
    const book = index.books.find(b => b.slug === bookSlug)
    const chapter = book?.chapters.find(c => c.slug === chapterSlug)
    const firstArticle = chapter?.articles[0]

    setActiveBookSlug(bookSlug)
    setActiveChapterSlug(chapterSlug)
    setActiveArticleSlug(firstArticle?.slug ?? null)
  }

  const handleSelectArticle = (bookSlug, chapterSlug, articleSlug) => {
    setActiveBookSlug(bookSlug)
    setActiveChapterSlug(chapterSlug)
    setActiveArticleSlug(articleSlug)
  }

  // Intercepte les liens wiki [[...]] (rendus en <a class="encyclo-link" href="#target"
  // data-target="target">) pour changer d'article quand la cible n'est pas dans l'article
  // courant. Le hash est déjà posé par le navigateur au clic natif (href="#target") ; une
  // fois le nouvel article rendu, l'effet de scroll existant d'ArticleView le consomme sans
  // rien manipuler ici. Si la cible est dans l'article déjà actif, on ne touche à rien —
  // l'ancre native gère déjà ce cas.
  const handleContentClick = (e) => {
    const link = e.target.closest('.encyclo-link')
    if (!link) return

    const target = link.dataset.target
    const resolved = resolveWikiTarget(index, target)
    if (!resolved) return

    const { bookSlug, chapterSlug, articleSlug } = resolved
    const isCurrentArticle = bookSlug === activeBookSlug
      && chapterSlug === activeChapterSlug
      && articleSlug === activeArticleSlug
    if (isCurrentArticle) return

    setActiveBookSlug(bookSlug)
    setActiveChapterSlug(chapterSlug)
    setActiveArticleSlug(articleSlug)
  }

  return (
    <div className="app-shell encyclo-viewer">
      <div className="encyclo-layout">
        <ChapterList
          index={index}
          activeBookSlug={activeBookSlug}
          activeChapterSlug={activeChapterSlug}
          activeArticleSlug={activeArticleSlug}
          onSelectChapter={handleSelectChapter}
          onSelectArticle={handleSelectArticle}
        />

        <main className="encyclo-content" onClick={handleContentClick}>
          <div className="card encyclo-card">
            {loading && (
              <div className="encyclo-loading">{t('states.loading')}</div>
            )}

            {error && (
              <div className="encyclo-error">{error}</div>
            )}

            {!loading && !error && article && <ArticleView article={article} />}

            {!loading && !error && !article && (
              <div className="encyclo-empty">{t('states.empty')}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}