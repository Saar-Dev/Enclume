// CalloutBlock.jsx — Bloc encadré pour l'Encyclopédie.
//
// Structure :
//   <aside class="encyclo-callout encyclo-callout-{variant}">
//     <div class="encyclo-callout-label">…</div>      ← optionnel (marqueur RAW)
//     <h4 class="encyclo-callout-title">…</h4>        ← optionnel
//     <div class="encyclo-callout-body">…</div>       ← sous-blocs récursifs
//   </aside>
//
// Le `label` porte un marqueur RAW (« OPTIONNEL », « RÈGLE AVANCÉE ») défini
// par le livre. Le `variant` (sidebar, example, note, optional, rule…)
// détermine le style visuel — stylé côté CSS, pas ici.
//
// Le titre est un vrai heading (`h4`, comme un sous-titre HeadingBlock) et non
// un `<div>` : un callout de premier niveau (ex. « Choc », « Séquelles ») porte
// un titre de section au même titre qu'un `heading` classique — sans balise
// sémantique, il était invisible pour un lecteur d'écran et absent de toute
// structure de titres. Un seul `id` DOM par callout (voir plus bas) : pas de
// second id sur le `h4`, pour éviter un doublon dans le document.
//
// L'`id` optionnel (block.id) est posé sur le <aside> pour permettre le
// ciblage par ancre — même convention que HeadingBlock. contentLoader.js
// (extractSections) doit en avoir un pour lister le callout au glossaire ;
// un callout sans `id` reste un titre visuel valide, juste non ciblable.
//
// Rendu des sous-blocs via `renderBlock` passé en prop par BlockRenderer,
// même pattern que ListBlock (évite l'import circulaire).
//
// Retourne null si l'encadré n'a ni label, ni titre, ni contenu :
// un callout vide créerait un bloc fantôme dans le flux.

export default function CalloutBlock({ block, renderBlock }) {
  const hasLabel = Boolean(block.label)
  const hasTitle = Boolean(block.title)
  const hasContent = Array.isArray(block.blocks) && block.blocks.length > 0

  if (!hasLabel && !hasTitle && !hasContent) return null

  const variant = block.variant || 'sidebar'

  return (
    <aside
      id={block.id || undefined}
      className={`encyclo-callout encyclo-callout-${variant}`}
    >
      {hasLabel && (
        <div className="encyclo-callout-label">{block.label}</div>
      )}
      {hasTitle && (
        <h4 className="encyclo-callout-title">{block.title}</h4>
      )}
      {hasContent && (
        <div className="encyclo-callout-body">
          {block.blocks.map((child, i) => (
            <div key={i}>{renderBlock(child)}</div>
          ))}
        </div>
      )}
    </aside>
  )
}