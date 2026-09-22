// ParagraphBlock.jsx — Bloc paragraphe pour l'Encyclopédie.
//
// Rend un <p> dont le contenu peut inclure les syntaxes inline
// ([[…]], **gras**, *italique*) — voir inlineParser.jsx.
//
// Retourne null si le texte est vide : évite un <p> fantôme dans le flux.
// Le parseInline gère lui-même les strings vides (retourne null), mais la
// garde locale est explicite et évite un appel inutile.

import { parseInline } from '../inlineParser.jsx'

export default function ParagraphBlock({ block }) {
  if (!block.text) return null

  return (
    <p className="encyclo-paragraph">
      {parseInline(block.text)}
    </p>
  )
}