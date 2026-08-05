// chatSanitizer.js — docs/PLANS/PLAN_CHAT.md §5.1 + §11. Échappe tout HTML, puis autorise
// exactement 4 patterns Markdown (gras, italique, code, citation) en les réintroduisant sous forme
// de balises fixes connues — jamais de HTML arbitraire.
//
// Pas de lib de sanitization (DOMPurify/sanitize-html/marked) : décision PLAN_CHAT.md §16, aucune
// n'est dans server/package.json et le besoin (4 patterns fixes) ne justifie pas la dépendance.
// L'échappement HTML se fait EN PREMIER : les remplacements Markdown n'insèrent ensuite que des
// balises connues autour de contenu déjà échappé — aucune chaîne utilisateur ne peut réintroduire
// une balise active.
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CODE_PLACEHOLDER_PREFIX = '@@CHATCODE'
const CODE_PLACEHOLDER_SUFFIX = '@@'

export function sanitizeMessageText(rawText) {
  let text = escapeHtml(rawText)

  // Code extrait en premier et mis de côté (placeholders) : son contenu ne doit jamais être
  // réinterprété comme gras/italique (ex. un backtick contenant deux astérisques ne doit pas être
  // lu comme du gras).
  const codeSpans = []
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = codeSpans.push(code) - 1
    return CODE_PLACEHOLDER_PREFIX + index + CODE_PLACEHOLDER_SUFFIX
  })

  // Citation : "> texte" en début de ligne uniquement (le ">" est déjà "&gt;" à ce stade)
  text = text.replace(/^&gt; ?(.+)$/gm, '<blockquote>$1</blockquote>')

  // Gras : **texte** — avant italique pour ne pas capturer un seul '*' des paires **
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')

  // Italique : *texte*
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')

  // Restauration des blocs code, non affectés par gras/italique/citation
  const placeholderPattern = new RegExp(`${CODE_PLACEHOLDER_PREFIX}(\\d+)${CODE_PLACEHOLDER_SUFFIX}`, 'g')
  text = text.replace(placeholderPattern, (_, index) => `<code>${codeSpans[Number(index)]}</code>`)

  return text
}
