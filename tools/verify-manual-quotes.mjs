// tools/verify-manual-quotes.mjs — Vérifie que chaque citation entre guillemets français d'un MANUEL (docs/MANUELS/) existe littéralement dans les fichiers RAW cités.
// Usage (depuis la racine) : node tools/verify-manual-quotes.mjs docs/MANUELS/MANUEL_X.md docs/REGLES/REGLE_X.md [autres sources…]
// Tolère la typographie (apostrophes, tirets, espaces) et les césures de l'extraction PDF ; un « … » ou « […] » dans une citation sépare des fragments vérifiés un à un.
// Code de sortie 1 s'il reste une citation introuvable. Ne vérifie PAS les tableaux de chiffres (à relire ou à contrôler à part).
import fs from 'node:fs'

const [manualPath, ...sourcePaths] = process.argv.slice(2)
const code = (n) => String.fromCharCode(n)
const hyphenationMarkers = new RegExp(`[${code(0xFFFE)}${code(0xFFFF)}${code(0x00AD)}${code(0xFFFD)}]\\s*`, 'g') // marqueur de césure de l'extraction PDF + saut de ligne qui le suit
const curlyApostrophes = new RegExp(`[${code(0x2018)}${code(0x2019)}${code(0x02BC)}]`, 'g')
const curlyQuotes = new RegExp(`[${code(0x201C)}${code(0x201D)}${code(0x00AB)}${code(0x00BB)}]`, 'g')
const dashes = new RegExp(`[${code(0x2212)}${code(0x2013)}${code(0x2014)}]`, 'g')
const nbsp = new RegExp(code(0x00A0), 'g')

const base = (text) => text
  .replace(hyphenationMarkers, '')
  .replace(curlyApostrophes, "'")
  .replace(curlyQuotes, '"')
  .replace(dashes, '-')
  .replace(nbsp, ' ')
// Deux lectures du texte extrait : trait d'union de fin de ligne conservé, ou supprimé (coupure de mot « dé-\ncider »).
const finish = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase()
const keepHyphen = (text) => finish(base(text).replace(/-\s*\n\s*/g, '-'))
const dropHyphen = (text) => finish(base(text).replace(/-\s*\n\s*/g, ''))

const sources = sourcePaths.map(path => {
  const text = fs.readFileSync(path, 'utf8')
  return { path, variants: [keepHyphen(text), dropHyphen(text)] }
})

const manual = fs.readFileSync(manualPath, 'utf8')
const open = code(0x00AB)
const close = code(0x00BB)
const quoteRegex = new RegExp(`${open}\\s*([^${close}]+?)\\s*${close}`, 'g')
const omission = new RegExp(`\\s*(?:\\[${code(0x2026)}\\]|${code(0x2026)})\\s*`)

const foundIn = (fragment) => sources.find(source => source.variants.some(variant => variant.includes(fragment)))
const quotes = [...manual.matchAll(quoteRegex)].map(m => m[1])
const perSource = new Map()
const failures = []
for (const quote of quotes) {
  const fragments = quote.split(omission).map(f => finish(base(f))).filter(f => f.length >= 6)
  const located = fragments.map(foundIn)
  if (located.every(Boolean)) {
    const source = located[0]?.path ?? '(fragment trop court)'
    perSource.set(source, (perSource.get(source) ?? 0) + 1)
  } else {
    failures.push({ quote, missing: fragments.filter((_, i) => !located[i]) })
  }
}
console.log(`citations : ${quotes.length} ; vérifiées : ${quotes.length - failures.length} ; à corriger : ${failures.length}`)
for (const [path, n] of perSource) console.log(`  ${n} dans ${path}`)
for (const f of failures) console.log('\n✖ ' + f.quote.slice(0, 150) + '\n   introuvable : ' + f.missing.map(m => m.slice(0, 130)).join(' | '))
process.exit(failures.length ? 1 : 0)
