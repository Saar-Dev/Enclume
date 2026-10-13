// actingToken.js
// Résout le token « acteur » pour l'utilisateur courant — celui à travers lequel une action
// s'exécute (suivi caméra 3e personne, interaction d'entité). Ordre de résolution unique :
//   1. parmi mes tokens possédés (character.user_id === userId) : celui désigné par
//      preferredOwnedTokenId (Tab, « qui je pilote ») s'il y en a un, sinon le premier trouvé
//   2. si je ne possède aucun token : celui actuellement sélectionné (anneau de sélection, clic —
//      MJ le plus souvent, qui sélectionne un PNJ pour agir via lui)
//   3. repli — un joueur sans token possédé ni sélection suit/agit via le premier token non-MJ
//
// preferredOwnedTokenId (SESSION-CAMERA-TOKEN-SELECTION-UNCLEAR, 2026-10-13) est délibérément
// SÉPARÉ de selectedTokenId : un joueur avec 2+ tokens possédés (PJ + drone/exo) n'avait aucun
// moyen de dire lequel il pilote — l'étape 1 prenait toujours le premier trouvé, jamais celui
// sélectionné au clic. Rester sur selectedTokenId pour cette étape aurait fait bouger la caméra au
// moindre clic sur son propre token (ex. pour ouvrir un menu) — régression de la décision Saar
// 2026-09-17 (« un simple clic ne doit faire QUE sélectionner, pas bouger la caméra »). Tab
// (Canvas3D.jsx) est l'unique geste qui change preferredOwnedTokenId.
//
// Avant ce fichier, ce calcul existait en double : une version complète dans Canvas3D.jsx
// (followToken, introduite Fusion Kiwi 2026-07-15) et une version tronquée (étape 1 seulement)
// dans SessionPage.jsx (handleEntityMove, Session 41 2026-04-30, jamais mise à jour) — un MJ sans
// token possédé ne pouvait donc jamais utiliser Déplacer/Ouvrir sur une entité, faute de repli sur
// la sélection. Le serveur reste seul autoritaire sur l'ownership réel de l'action
// (`.claude/rules/entities.md`) — ce résolveur exprime une intention côté client, jamais une
// autorisation.

// Tous les tokens possédés par userId, dans l'ordre stable de `tokens` (jamais retrié, voir
// tokenStore.js) — autorité unique de l'appartenance, réutilisée par le résolveur ET par le cycle
// Tab (Canvas3D.jsx) plutôt que de dupliquer ce filtre une 3e fois.
export function getOwnedTokens({ tokens, characters, userId }) {
  return tokens.filter(token =>
    characters.some(character => character.id === token.character_id && character.user_id === userId)
  )
}

// Token possédé suivant dans l'ordre de cycle (Tab) — boucle, et retombe sur le premier possédé
// si currentId ne correspond à aucun token possédé (rien sélectionné encore, ou token piloté
// disparu depuis — drone détruit). null si ownedTokens est vide (rien à cycler).
export function getNextOwnedTokenId({ ownedTokens, currentId }) {
  if (ownedTokens.length === 0) return null
  const currentIndex = ownedTokens.findIndex(token => token.id === currentId)
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % ownedTokens.length
  return ownedTokens[nextIndex].id
}

export function resolveActingToken({ tokens, characters, userId, selectedTokenId, preferredOwnedTokenId, isGm }) {
  const ownedTokens = getOwnedTokens({ tokens, characters, userId })
  if (ownedTokens.length > 0) {
    const preferred = preferredOwnedTokenId && ownedTokens.find(token => token.id === preferredOwnedTokenId)
    return preferred || ownedTokens[0]
  }
  if (selectedTokenId) return tokens.find(token => token.id === selectedTokenId) || null
  if (!isGm) return tokens.find(token => token.layer !== 'gm') || null
  return null
}
