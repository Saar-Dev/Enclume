// ListBlock.jsx — Bloc liste pour l'Encyclopédie.
//
// Supporte :
//   - listes ordonnées (block.ordered === true) → <ol>
//   - listes à puces (block.ordered === false)  → <ul>
//   - items avec label optionnel (rendu inline : [[…]], **gras**, *italique*)
//   - items contenant des sous-blocs récursifs (y compris d'autres listes)
//
// Dépendance circulaire évitée : ce composant n'importe PAS BlockRenderer.
// C'est le parent (BlockRenderer) qui lui passe sa propre fonction `renderBlock`
// en prop. Permet aussi de tester ListBlock en isolation.
//
// Le <li> peut contenir un <div> de label + n'importe quel bloc enfant :
// c'est valide HTML (le contenu d'un <li> peut être du flow content).

import { Fragment } from 'react'
import { parseInline } from '../inlineParser.jsx'

export default function ListBlock({ block, renderBlock }) {
  if (!block.items || block.items.length === 0) return null

  const Tag = block.ordered ? 'ol' : 'ul'
  const modifier = block.ordered ? 'ordered' : 'unordered'

  return (
    <Tag className={`encyclo-list encyclo-list-${modifier}`}>
      {block.items.map((item, i) => (
        <li key={i} className="encyclo-list-item">
          {item.label && (
            <div className="encyclo-list-label">
              {parseInline(item.label)}
            </div>
          )}
          {item.blocks?.map((child, j) => (
            <Fragment key={j}>
              {renderBlock(child)}
            </Fragment>
          ))}
        </li>
      ))}
    </Tag>
  )
}