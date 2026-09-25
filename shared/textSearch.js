// shared/textSearch.js — autorité unique de la recherche de texte tolérante d'Enclume (client + serveur).
//
// Toute recherche saisie par un utilisateur (inventaire, catalogues, cartes, joueurs, palette d'objets,
// suggestions de compétence…) passe par ce module : jamais un `toLowerCase().includes(q)` local, jamais
// une copie de la normalisation. Tolérant à : la casse, les accents (é è ô ï ç…), les ligatures
// (œ → oe, æ → ae), les apostrophes typographiques (’ ‘ ʼ ´ ` → '), les tirets et espaces multiples.
// Pas de recherche floue (fautes de frappe) : décision Saar 2026-09-25, hors périmètre.
//
// Deux niveaux :
//  - `foldAccents`  : primitive minimale (minuscules sans accents) — pour classer / comparer un texte
//                     technique (libellé de paquet, url) sans changer sa ponctuation ;
//  - `foldForSearch`: normalisation complète de recherche, appliquée à la requête ET au texte cherché.

const COMBINING_MARKS = /\p{M}/gu   // marques combinantes Unicode (accents après décomposition NFD)
const APOSTROPHES     = /[’‘ʼ´`]/g
const DASHES          = /\p{Pd}/gu  // tous les tirets Unicode (- ‐ ‑ – — …)

/** Minuscules, accents supprimés. Ponctuation, ligatures et espaces inchangés. */
export function foldAccents(value) {
  return String(value ?? '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

/** Normalisation complète de recherche : casse, accents, ligatures, apostrophes, tirets, espaces. */
export function foldForSearch(value) {
  return foldAccents(value)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(APOSTROPHES, "'")
    .replace(DASHES, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Prépare une requête une seule fois pour filtrer une liste (la requête n'est pas re-normalisée à chaque
 * élément). Le prédicat retourné reçoit un ou plusieurs champs texte ; il est vrai quand CHAQUE mot de la
 * requête se retrouve dans l'un des champs, dans n'importe quel ordre. Requête vide → tout passe.
 */
export function createSearchMatcher(query) {
  const tokens = foldForSearch(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return () => true
  return (...fields) => {
    const haystack = fields.map(foldForSearch).join(' ')
    return tokens.every(token => haystack.includes(token))
  }
}

/** Forme directe pour un test isolé : `matchesSearch('epee', item.name, item.category)`. */
export function matchesSearch(query, ...fields) {
  return createSearchMatcher(query)(...fields)
}
