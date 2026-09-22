// inlineParser.jsx — Parse les syntaxes inline du contenu Encyclopédie.
//
// Règles supportées (v1) :
//   [[Label|target]]        → lien interne vers un article ou une ancre
//   [[Label|target|page]]   → idem + référence de page (data-page)
//   [[Label]]               → lien brisé (target manquant, signalé visuellement via CSS)
//   **gras**                → <strong>
//   *italique*              → <em>
//
// Non supporté en v1 (documenté, pas géré) :
//   - Nesting entre ces syntaxes (gras dans un lien, lien dans un gras…)
//   - Plus de 3 segments dans [[…]] (traité comme lien brisé)
//   - [[…]] non fermé (traité comme texte brut)
//
// Renvoie des ReactNode (pas de HTML string). Pas d'escape manuel :
// React échappe automatiquement les strings.
//
// La navigation utilise pour l'instant une ancre native (#target).
// Elle sera remplacée par un <Link> React Router lors du branchement dans Enclume.
//
// Note i18n : ce module n'est pas un composant React, il ne peut pas utiliser
// useTranslation. Les liens brisés sont signalés uniquement visuellement
// (classe CSS .encyclo-link-broken), pas par un tooltip traduit.

// ─── Tokenisation ────────────────────────────────────────────────
// Regex unique avec alternation : lien | gras | italique.
// Créée dans la fonction pour éviter tout état persistant (lastIndex).

function tokenize(text) {
  if (!text) return []

  const re = /\[\[([^\]|]+)(?:\|([^\]|]+))?(?:\|([^\]|]+))?\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*/g

  const tokens = []
  let lastIndex = 0
  let m

  while ((m = re.exec(text)) !== null) {
    // Texte brut entre le dernier match et celui-ci
    if (m.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, m.index) })
    }

    if (m[1] !== undefined) {
      // Lien wiki
      tokens.push({
        type: 'link',
        label: m[1],
        target: m[2] ?? null,
        page: m[3] ?? null,
      })
    } else if (m[4] !== undefined) {
      tokens.push({ type: 'bold', value: m[4] })
    } else if (m[5] !== undefined) {
      tokens.push({ type: 'italic', value: m[5] })
    }

    lastIndex = m.index + m[0].length
  }

  // Texte restant après le dernier match
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return tokens
}

// ─── Rendu d'un token ────────────────────────────────────────────

function renderToken(token, key) {
  switch (token.type) {
    case 'text':
      return token.value

    case 'bold':
      return <strong key={key}>{token.value}</strong>

    case 'italic':
      return <em key={key}>{token.value}</em>

    case 'link':
      if (!token.target) {
        // Forme courte [[Label]] sans cible résolue — signalé visuellement
        // par la classe CSS (couleur warning + bordure pointillée).
        return (
          <span key={key} className="encyclo-link-broken">
            {token.label}
          </span>
        )
      }
      return (
        <a
          key={key}
          className="encyclo-link"
          href={`#${token.target}`}
          data-target={token.target}
          data-page={token.page || undefined}
        >
          {token.label}
        </a>
      )

    default:
      return null
  }
}

// ─── API publique ────────────────────────────────────────────────
// parseInline(text) → array de ReactNode

export function parseInline(text) {
  const tokens = tokenize(text)
  if (tokens.length === 0) return null
  return tokens.map((token, i) => renderToken(token, i))
}