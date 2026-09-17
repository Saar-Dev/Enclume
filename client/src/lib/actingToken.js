// actingToken.js
// Résout le token « acteur » pour l'utilisateur courant — celui à travers lequel une action
// s'exécute (suivi caméra 3e personne, interaction d'entité). Ordre de résolution unique :
//   1. token possédé par le compte (character.user_id === userId)
//   2. token actuellement sélectionné (anneau de sélection, MJ le plus souvent)
//   3. repli — un joueur sans token possédé suit/agit via le premier token non-MJ de la carte
//
// Avant ce fichier, ce calcul existait en double : une version complète dans Canvas3D.jsx
// (followToken, introduite Fusion Kiwi 2026-07-15) et une version tronquée (étape 1 seulement)
// dans SessionPage.jsx (handleEntityMove, Session 41 2026-04-30, jamais mise à jour) — un MJ sans
// token possédé ne pouvait donc jamais utiliser Déplacer/Ouvrir sur une entité, faute de repli sur
// la sélection. Le serveur reste seul autoritaire sur l'ownership réel de l'action
// (`.claude/rules/entities.md`) — ce résolveur exprime une intention côté client, jamais une
// autorisation.
export function resolveActingToken({ tokens, characters, userId, selectedTokenId, isGm }) {
  const owned = tokens.find(token =>
    characters.some(character => character.id === token.character_id && character.user_id === userId)
  )
  if (owned) return owned
  if (selectedTokenId) return tokens.find(token => token.id === selectedTokenId) || null
  if (!isGm) return tokens.find(token => token.layer !== 'gm') || null
  return null
}
