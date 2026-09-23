// EncyclopediaViewer.jsx — Contenu réel de l'Encyclopédie (nav + article), extrait de
// EncyclopediaPage.jsx le 2026-09-23 pour être réutilisable dans deux contextes :
//   - EncyclopediaPage.jsx (route standalone /encyclopedia, plein écran, hors session)
//   - EncyclopediaWindow.jsx (fenêtre en jeu, montée dans SessionPage, taille bornée)
//
// Ce composant ne porte aucune hypothèse sur son conteneur (pas de .app-shell ici — c'est
// à l'appelant de fournir le contexte de mise en page). Il gère uniquement la sélection
// livre/chapitre/article et le chargement des données.
//
// `embedded` (défaut false) : passé à ChapterList — en mode embedded, le bouton Glossaire
// bascule une vue interne (`showGlossary`) au lieu de naviguer vers /encyclopedia/glossary
// (une vraie navigation démonterait la session depuis la fenêtre en jeu). Voir
// GlossaryViewer.jsx et handleGlossarySelect ci-dessous.
//
// i18n : namespace 'encyclopedia' (voir locales/encyclopedia.json).

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getIndex, loadArticle, resolveWikiTarget } from './contentLoader.js'
import ChapterList from './ChapterList.jsx'
import ArticleView from './ArticleView.jsx'
import GlossaryViewer from './GlossaryViewer.jsx'

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

// Résout le hash déjà présent dans l'URL au montage (ex. arrivée depuis un lien Glossaire,
// trouvaille au passage 2026-09-23 : ce cas n'était géré nulle part avant — un lien Glossaire
// retombait toujours sur le premier article par défaut, le hash restait inerte, ArticleView
// cherchait l'ancre dans le mauvais article et ne trouvait jamais rien). Retombe sur le
// premier article du premier chapitre non vide si pas de hash ou non résolu.
//
// Lecture directe (pas useMemo) : `window.location.hash` est une valeur externe impure, le
// React Compiler refuse de la memoizer (react-hooks/preserve-manual-memoization) — appelée
// en initialiseur paresseux de useState ci-dessous, donc une seule fois par état au montage.
function computeInitialSelection(index) {
  const hash = window.location.hash.slice(1)
  if (hash) {
    const resolved = resolveWikiTarget(index, hash)
    if (resolved) return resolved
  }
  return pickDefaultSelection(index)
}

export default function EncyclopediaViewer({ embedded = false }) {
  const { t } = useTranslation('encyclopedia')

  const index = useMemo(() => getIndex('fr'), [])

  const [activeBookSlug, setActiveBookSlug] = useState(() => computeInitialSelection(index)?.bookSlug ?? null)
  const [activeChapterSlug, setActiveChapterSlug] = useState(() => computeInitialSelection(index)?.chapterSlug ?? null)
  const [activeArticleSlug, setActiveArticleSlug] = useState(() => computeInitialSelection(index)?.articleSlug ?? null)
  const [showGlossary, setShowGlossary] = useState(false)

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
    // Sélectionne automatiquement le premier article du chapitre (son introduction)
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

  // Clic sur une section du glossaire intégré (embedded uniquement, voir GlossaryViewer.jsx) —
  // même résolution que les liens wiki. Le hash est posé manuellement (ce n'est pas un <a>
  // natif ici, pas de comportement de navigateur à côté duquel se reposer) pour que l'effet
  // de scroll déjà existant dans ArticleView le trouve une fois le nouvel article rendu.
  const handleGlossarySelect = (sectionId) => {
    const resolved = resolveWikiTarget(index, sectionId)
    if (!resolved) return

    window.location.hash = sectionId
    setActiveBookSlug(resolved.bookSlug)
    setActiveChapterSlug(resolved.chapterSlug)
    setActiveArticleSlug(resolved.articleSlug)
    setShowGlossary(false)
  }

  if (showGlossary) {
    return (
      <div className="encyclo-glossary-embedded">
        <button
          type="button"
          className="encyclo-nav-collapse-toggle encyclo-glossary-embedded-back"
          onClick={() => setShowGlossary(false)}
          title={t('nav.backToArticles')}
        >
          «
        </button>
        <GlossaryViewer onSelectSection={handleGlossarySelect} />
      </div>
    )
  }

  return (
    <div className="encyclo-layout">
      <ChapterList
        index={index}
        activeBookSlug={activeBookSlug}
        activeChapterSlug={activeChapterSlug}
        activeArticleSlug={activeArticleSlug}
        onSelectChapter={handleSelectChapter}
        onSelectArticle={handleSelectArticle}
        embedded={embedded}
        onOpenGlossary={() => setShowGlossary(true)}
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
  )
}
