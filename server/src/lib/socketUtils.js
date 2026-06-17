// Utilitaires partagés entre les handlers socket — extraction REWORK-07.
// Aucune logique métier : pattern lookup couleur + vérification ownership token.

export async function getUserColor(db, userId, fallback = '#5b8dee') {
  try {
    const userRow = await db('users').where({ id: userId }).select('color').first()
    if (userRow?.color) return userRow.color
  } catch (_) {}
  return fallback
}

// token doit être déjà chargé par le caller.
// Charge characters si token.character_id présent.
export async function checkTokenOwnership(db, token, userId, role) {
  const isGm = role === 'gm'
  let isOwner = false
  if (token.character_id) {
    const character = await db('characters').where({ id: token.character_id }).first()
    isOwner = character?.user_id === userId
  }
  return { isGm, isOwner }
}
