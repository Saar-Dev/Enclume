// combatDamageQueue.js — File d'attente des invitations "Gestion des dégâts" (COMBAT_DAMAGE_PROMPT/
// COMBAT_DAMAGE_RESULT) pour un même tireur PJ touchant plusieurs cibles dans le même round. Le
// serveur émet COMBAT_DAMAGE_PROMPT(cible suivante) avant COMBAT_DAMAGE_RESULT(cible courante)
// (confirmDamage, server/src/socket/socketCombatHelpers.js) : sans file côté client, les deux
// écrasaient le même état plat et la fenêtre affichait le nom d'une cible avec les dégâts d'une
// autre (COMBAT-DAMAGE-WINDOW-WRONG-TARGET). Même patron que CatastropheChoiceQueue.jsx — une file,
// un seul élément affiché à la fois, le suivant n'apparaît qu'après fermeture explicite du
// précédent — plutôt qu'un état inventé pour l'occasion.

export function pushDamagePrompt(queue, payload) {
  return [...queue, { payload, results: null }]
}

// Le résultat qui arrive correspond toujours à l'entrée la plus ancienne sans résultat encore
// attaché : un seul jet peut être "en vol" à la fois (le bouton Lancer n'est actionnable que sur la
// tête de file). On ne suppose jamais que c'est la tête par position — si l'ordre d'arrivée
// changeait, attacher au mauvais indice recréerait exactement le bug corrigé ici.
export function attachDamageResult(queue, results) {
  const index = queue.findIndex(entry => entry.results === null)
  if (index === -1) return queue
  return queue.map((entry, i) => (i === index ? { ...entry, results } : entry))
}

export function dismissDamageQueueHead(queue) {
  return queue.slice(1)
}

export function currentDamageEntry(queue) {
  return queue[0] ?? null
}
