// HeadingBlock.jsx — Bloc de titre pour l'Encyclopédie.
//
// Rend un heading HTML (h2 à h5) avec :
//   - le niveau fourni par le JSON (block.level)
//   - un id d'ancre optionnel (block.id) — voir ENCYCLOPEDIA_CONVERSION.md §4.2
//   - une classe CSS par niveau (encyclo-heading-{level})
//
// Le niveau est une donnée, pas une décision du composant. La hiérarchie
// globale du document (h1 pour chapitre, h2 pour article) est posée par
// les composants parents, pas ici.

export default function HeadingBlock({ block }) {
  const level = block.level || 3
  const Tag = `h${level}`

  return (
    <Tag
      id={block.id || undefined}
      className={`encyclo-heading encyclo-heading-${level}`}
    >
      {block.title}
    </Tag>
  )
}