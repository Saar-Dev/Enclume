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

// character déjà chargé par le caller (peut être null/undefined → false).
// Autorité pour une action de jeu à conséquence mécanique (test, jet, déplacement) déclenchée « au
// nom » d'un personnage : le joueur propriétaire, ou le MJ mais seulement pour un PNJ (jamais un PJ
// — autorité du joueur préservée ; jamais un drone — pilotage télécommandé dédié, hors périmètre).
// Distinct de checkTokenOwnership ci-dessus (manipulation brute d'un token, MJ illimité) et de
// ENTITY_ACTION_GM_DIRECT (action MJ directe sans personnage engagé, sans test) — patron déjà
// éprouvé dans COMBAT_INIT_STATE (socketCombatState.js), extrait ici pour son 2e appelant
// (docs/PLANS/PLAN_AUTORITE_PERSONNAGE_SERVEUR.md recense les usages encore dupliqués ailleurs).
export function canActAsCharacter(character, { userId, isGm }) {
  if (!character) return false
  if (isGm) return character.type === 'pnj'
  return character.user_id === userId
}
