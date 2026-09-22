// ArticleView.jsx — Vue d'un article d'Encyclopédie.
//
// Rend :
//   - le titre de l'article (h2) + la page (à droite)
//   - les blocs du contenu via BlockRenderer
//
// L'id de l'article est posé sur <article> pour servir d'ancre
// aux liens wiki (ex. [[Organisation du combat|combat.organisation]]).
//
// Les titres internes au contenu sont des h3+ (voir HeadingBlock.jsx) :
// la hiérarchie h1 (chapitre) / h2 (article) / h3+ (sections) est cohérente.
//
// Scroll : le chargement de l'article est asynchrone (contentLoader), donc au
// moment où le navigateur traite le hash de l'URL, la cible n'existe pas encore
// dans le DOM. Ce composant gère deux cas à chaque changement d'article :
//   - hash présent → scroll sur la cible après rendu (setTimeout 0)
//   - pas de hash → scroll en haut de page (nouvel article lu depuis le début)

import { useEffect } from 'react'
import BlockRenderer from './BlockRenderer.jsx'

export default function ArticleView({ article }) {
  useEffect(() => {
    if (!article) return

    const hash = window.location.hash.slice(1)
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }

    // setTimeout(0) : laisse React finir de peindre les sous-blocs (dataTable
    // notamment) avant de chercher la cible.
    const timer = setTimeout(() => {
      const target = document.getElementById(hash)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [article])

  if (!article) return null

  return (
    <article id={article.id} className="encyclo-article">
      <header className="encyclo-article-header">
        <h2 className="encyclo-article-title">{article.title}</h2>
        {article.page && (
          <span className="encyclo-article-page">p. {article.page}</span>
        )}
      </header>
      <div className="encyclo-article-body">
        {article.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </article>
  )
}