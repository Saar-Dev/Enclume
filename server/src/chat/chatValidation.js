// chatValidation.js — docs/PLANS/PLAN_CHAT.md §5.1 + §11 (longueur max 2000, type connu).
// Validateur maison, pas de lib de schéma (Zod) : décision PLAN_CHAT.md §16, aucun autre module
// serveur n'utilise Zod.
//
// Couvre les deux formes de message que l'utilisateur peut réellement envoyer en V1 (POST texte,
// chat:send, /w) : TEXT et WHISPER. Les types produits par les Message Builders (COMBAT_DAMAGE,
// SYSTEM_JOIN, DICE…) sont des messages système à payload structuré, pas de la saisie utilisateur —
// leurs règles de forme seront ajoutées Phase 2+ au moment où chaque builder est réellement branché,
// pas anticipées ici sans le vrai payload de référence.
const MAX_TEXT_LENGTH = 2000
const USER_SUBMITTABLE_TYPES = new Set(['TEXT', 'WHISPER'])

// Retourne un message d'erreur (string) si invalide, ou null si le payload est acceptable.
export function validateMessagePayload({ type, payload }) {
  if (!USER_SUBMITTABLE_TYPES.has(type)) {
    return `type "${type}" inconnu ou non soumissible par l'utilisateur`
  }
  if (typeof payload?.text !== 'string' || payload.text.trim().length === 0) {
    return 'payload.text manquant ou vide'
  }
  if (payload.text.length > MAX_TEXT_LENGTH) {
    return `payload.text dépasse ${MAX_TEXT_LENGTH} caractères`
  }
  if (type === 'WHISPER' && typeof payload.recipientUserId !== 'string') {
    return 'payload.recipientUserId requis pour un whisper'
  }
  return null
}

export { MAX_TEXT_LENGTH }
