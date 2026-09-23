// contentLoader.js — Chargement du contenu Encyclopédie.
//
// Deux niveaux :
//   - Index (léger) : import statique, contient la structure de navigation complète
//     (titre/pages de chapitre inclus — plus de fichier _chapter.json séparé,
//     supprimé 2026-09-23 : la citation/texte de cadrage de chaque chapitre est
//     désormais un article normal comme un autre, `<chapitre>.introduction`,
//     toujours en première position dans `articles[]`)
//   - Article : fichier JSON individuel chargé à la demande
//
// Le glob matche les articles dans les sous-dossiers de chapitre
// (ex. fr/livre-4/combat/organisation.json).
//
// loadGlossary() : parcourt tous les articles en parallèle, extrait les sections
// ciblables (headings avec id + callouts avec id), retourne un arbre
// livre → chapitre → article → sections. Les articles non convertis sont ignorés.

import frIndex from './fr/_index.json'

const INDEXES = {
  fr: frIndex,
}

export function getIndex(lang = 'fr') {
  const index = INDEXES[lang]
  if (!index) {
    throw new Error(`Index introuvable pour la langue : ${lang}`)
  }
  return index
}

const ARTICLE_MODULES = import.meta.glob([
  './*/livre-*/*/*.json',
  '!./*/livre-*/*/_*.json',
])

export async function loadArticle(lang, bookSlug, chapterSlug, articleSlug) {
  const key = `./${lang}/${bookSlug}/${chapterSlug}/${articleSlug}.json`
  const loader = ARTICLE_MODULES[key]
  if (!loader) throw new Error(`Article introuvable : ${key}`)
  const mod = await loader()
  return mod.default
}

// ─── Glossaire ───────────────────────────────────────────
// Charge tous les articles en parallèle et construit l'arbre des sections.
// Les articles non convertis (fichier absent) sont ignorés silencieusement.
export async function loadGlossary(lang = 'fr') {
  const index = getIndex(lang)

  const bookPromises = index.books.map(async book => {
    const chapterPromises = book.chapters.map(async chapter => {
      const articlePromises = chapter.articles.map(async articleMeta => {
        try {
          const article = await loadArticle(lang, book.slug, chapter.slug, articleMeta.slug)
          const sections = extractSections(article.blocks)
          if (sections.length === 0) return null
          return {
            id: articleMeta.id,
            slug: articleMeta.slug,
            title: articleMeta.title,
            sections,
          }
        } catch {
          return null
        }
      })

      const articles = (await Promise.all(articlePromises)).filter(Boolean)
      if (articles.length === 0) return null
      return { slug: chapter.slug, title: chapter.title, articles }
    })

    const chapters = (await Promise.all(chapterPromises)).filter(Boolean)
    if (chapters.length === 0) return null
    return { slug: book.slug, title: book.title, chapters }
  })

  return (await Promise.all(bookPromises)).filter(Boolean)
}

// Sections ciblables d'un article : headings (level 3-5) et callouts avec id.
//
// Récursif : un callout de premier niveau (ex. « Choc », « Fatigue ») encadre souvent ses propres
// sous-headings RAW (« Effets du Choc », « Durée du Choc ») dans `block.blocks` — sans récursion,
// ces sous-titres restent des ancres DOM valides (rendues par BlockRenderer) mais invisibles au
// glossaire. Un item de liste peut aussi porter des sous-blocs (`item.blocks`) — même traitement.
function extractSections(blocks) {
  const sections = []
  for (const block of blocks) {
    if (block.type === 'heading' && block.id) {
      sections.push({ id: block.id, title: block.title, level: block.level })
    } else if (block.type === 'callout' && block.id) {
      sections.push({ id: block.id, title: block.title, level: null })
    }

    if (block.type === 'callout' && Array.isArray(block.blocks)) {
      sections.push(...extractSections(block.blocks))
    } else if (block.type === 'list' && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (Array.isArray(item.blocks)) sections.push(...extractSections(item.blocks))
      }
    }
  }
  return sections
}

// ─── Utilitaires ─────────────────────────────────────────

export function findArticleMeta(index, articleId) {
  for (const book of index.books) {
    for (const chapter of book.chapters) {
      const article = chapter.articles.find(a => a.id === articleId)
      if (article) return { book, chapter, article }
    }
  }
  return null
}

// Résout la cible d'un lien wiki [[Label|cible]] vers une sélection navigable
// { bookSlug, chapterSlug, articleSlug }, ou null si rien ne correspond.
//
// Trois formes de cible (voir ENCYCLOPEDIA_CONVERSION.md §5) :
//   - id d'article complet (`chapitre.article`) — résolution directe
//   - ancre à l'intérieur d'un autre article (`chapitre.article.section`) — l'id d'article
//     est le préfixe le plus long parmi tous les articles de l'index (frontière de point
//     stricte : `a.id + '.'`, pour ne jamais matcher un id qui n'est que visuellement préfixe)
//   - slug de chapitre seul (pas de point) — sélectionne le premier article du chapitre
export function resolveWikiTarget(index, target) {
  if (!target) return null

  if (!target.includes('.')) {
    for (const book of index.books) {
      const chapter = book.chapters.find(c => c.slug === target)
      if (chapter && chapter.articles.length > 0) {
        return { bookSlug: book.slug, chapterSlug: chapter.slug, articleSlug: chapter.articles[0].slug }
      }
    }
    return null
  }

  const direct = findArticleMeta(index, target)
  if (direct) {
    return { bookSlug: direct.book.slug, chapterSlug: direct.chapter.slug, articleSlug: direct.article.slug }
  }

  for (const book of index.books) {
    for (const chapter of book.chapters) {
      const article = chapter.articles.find(a => target.startsWith(`${a.id}.`))
      if (article) {
        return { bookSlug: book.slug, chapterSlug: chapter.slug, articleSlug: article.slug }
      }
    }
  }

  return null
}