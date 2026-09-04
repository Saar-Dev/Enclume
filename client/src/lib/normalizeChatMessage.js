// normalizeChatMessage.js — docs/PLANS/PLAN_CHAT_COMMANDES.md §5.
//
// DICE persisté : jamais rediffusé via CHAT_MESSAGE_CREATED (un second broadcast dupliquerait le jet
// déjà reçu en direct via DICE_RESULT, socketDice.js), donc rencontré uniquement à la lecture
// d'historique (useChatSocket.js) — jamais dans le flux temps réel. payload porte les mêmes champs que
// le DICE_RESULT live (useSessionSocket.js:onDiceResult) mais imbriqués sous message.payload (forme
// générique chatService.toClientMessage), avec `username` au lieu de `user`. renderDice
// (MessageRendererRegistry.jsx) n'a jamais vu que la forme plate avec `user` — aplatir et renommer ici,
// un seul point partagé par l'historique initial et le scroll infini, plutôt que de dupliquer/modifier
// le rendu déjà éprouvé. Fonction pure, extraite de useChatSocket.js pour rester testable sans les
// dépendances React/socket/store du hook.
export function normalizeMessage(msg) {
  if (msg.type !== 'DICE') return msg
  const { username, ...rest } = msg.payload
  return {
    ...rest,
    id: msg.id,
    type: 'dice',
    user: username,
    // createdAt conservé explicitement (jamais dans payload) : le tri chronologique de l'appelant
    // (merged.sort) le lit sur tous les messages, DICE inclus — trouvé en relisant le point d'appel.
    createdAt: msg.createdAt,
    time: new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}
