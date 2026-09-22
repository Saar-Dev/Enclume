// BlockRenderer.jsx — Dispatcher de blocs pour l'Encyclopédie.
//
// Reçoit un block (objet JSON avec un champ `type`) et rend le composant
// correspondant. Passe `renderBlock` (une fonction wrapper qui retourne du
// JSX) en prop aux blocs qui peuvent contenir des sous-blocs — ListBlock et
// CalloutBlock — pour permettre la récursion sans import circulaire.
//
// Historique : avant, on passait `BlockRenderer` directement. ListBlock et
// CalloutBlock appelaient `renderBlock(child)`, ce qui exécutait
// `BlockRenderer(child)` — et non `BlockRenderer({ block: child })`.
// Résultat : `block` était `undefined`, la garde retournait `null`, et le
// contenu des callouts et listes était invisible. Fix : wrapper explicite.
//
// Type inconnu → placeholder visible (encadré rouge dashed via .encyclo-unknown).
// dataTable : placeholder Phase 1 (voir DataTableBlock.jsx).

import HeadingBlock from './blocks/HeadingBlock.jsx'
import ParagraphBlock from './blocks/ParagraphBlock.jsx'
import ListBlock from './blocks/ListBlock.jsx'
import CalloutBlock from './blocks/CalloutBlock.jsx'
import DataTableBlock from './blocks/DataTableBlock.jsx'

export default function BlockRenderer({ block }) {
  if (!block || !block.type) return null

  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />

    case 'paragraph':
      return <ParagraphBlock block={block} />

    case 'list':
      return <ListBlock block={block} renderBlock={(b) => <BlockRenderer block={b} />} />

    case 'callout':
      return <CalloutBlock block={block} renderBlock={(b) => <BlockRenderer block={b} />} />

    case 'dataTable':
      return <DataTableBlock block={block} />

    default:
      return (
        <div className="encyclo-unknown">
          Type de bloc inconnu : {block.type}
        </div>
      )
  }
}