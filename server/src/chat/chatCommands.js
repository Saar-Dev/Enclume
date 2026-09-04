// chatCommands.js — docs/PLANS/PLAN_CHAT.md §5.6. Registre de commandes slash.
//
// Portée V1 réelle (§15 "Hors scope V1" : "/r migré vers le Command Registry (reste dans
// Sidebar.jsx en attendant)") : /r et son alias /roll restent sur le flux DICE_ROLL existant, hors
// de ce registre — l'exemple de code §5.6 qui les enregistre ici est une illustration du design
// cible, pas la portée V1. /help, /w, /gm, /heal, /t sont réellement enregistrés
// (docs/PLANS/PLAN_CHAT_COMMANDES.md).
//
// i18n (.claude/rules/i18n.md, chargée en écrivant ce fichier) : "le serveur n'émet jamais de texte
// FR figé destiné à l'utilisateur" — pattern system:true + i18nKey (socketCombatHelpers.js,
// useSessionSocket.js). Aucune des chaînes retournées ici n'est un texte final : ce sont des clés
// i18n sous le namespace `chat.commands.*`, à créer dans client/src/locales/ en Phase 3 (rendu
// client) — pas maintenant, ce module n'émet rien tant qu'il n'est pas branché dans socketChat.js.
//
// Contrat execute(context, args) : retourne { reply: { i18nKey, params? } } (réponse privée non
// persistée), { send: { channelId, type, payload, recipientUserId } } (intention de message à
// transmettre par l'appelant à chatService.sendMessage), ou { handled: true } (effet déjà entièrement
// produit par une closure du context — ex. /t, dont le jet broadcast DICE_RESULT lui-même ; rien de
// plus à faire côté socketChat.js, docs/PLANS/PLAN_CHAT_COMMANDES.md §6). Ce module ne touche jamais la
// DB ni chatService directement — l'orchestration reste dans socketChat.js, qui construit le `context`
// (accès campagne) et exécute le `send` retourné.
export class CommandRegistry {
  constructor() {
    this.commands = new Map()
  }

  register(command) {
    this.commands.set(command.name, command)
  }

  list() {
    return [...this.commands.values()]
  }

  async execute(name, context, args) {
    const cmd = this.commands.get(name)
    if (!cmd) throw new Error(`Commande inconnue : /${name}`)
    // §5.6 déclarait `permission` sur chaque commande sans jamais le vérifier. Aucune commande V1
    // n'est 'gm' aujourd'hui, mais laisser le champ mort serait trompeur pour la suite (PLAN_CHAT.md §16).
    if (cmd.permission === 'gm' && !context.isGm) {
      throw new Error(`Commande /${name} réservée au MJ`)
    }
    return cmd.execute(context, args)
  }
}

export const chatCommandRegistry = new CommandRegistry()

chatCommandRegistry.register({
  name: 'help',
  descriptionKey: 'chat.commands.help.description',
  permission: 'player',
  execute() {
    const commands = chatCommandRegistry.list().map((cmd) => ({
      name: cmd.name,
      descriptionKey: cmd.descriptionKey,
    }))
    return { reply: { i18nKey: 'chat.commands.help.list', params: { commands } } }
  },
})

// context.findCampaignMemberByUsername(username) -> { userId } | null — fourni par socketChat.js.
chatCommandRegistry.register({
  name: 'w',
  descriptionKey: 'chat.commands.whisper.description',
  permission: 'player',
  async execute(context, args) {
    const [targetUsername, ...rest] = args
    const text = rest.join(' ')
    if (!targetUsername || !text) {
      return { reply: { i18nKey: 'chat.commands.whisper.usage' } }
    }
    const target = await context.findCampaignMemberByUsername(targetUsername)
    if (!target) {
      return { reply: { i18nKey: 'chat.commands.whisper.targetNotFound', params: { username: targetUsername } } }
    }
    return {
      send: {
        channelId: 'whisper',
        type: 'WHISPER',
        recipientUserId: target.userId,
        payload: { text, recipientUserId: target.userId },
      },
    }
  },
})

// context.gmUserId — fourni par socketChat.js (MJ de la campagne courante).
chatCommandRegistry.register({
  name: 'gm',
  descriptionKey: 'chat.commands.gm.description',
  permission: 'player',
  async execute(context, args) {
    const text = args.join(' ')
    if (!text) return { reply: { i18nKey: 'chat.commands.gm.usage' } }
    if (!context.gmUserId) return { reply: { i18nKey: 'chat.commands.gm.notFound' } }
    return {
      send: {
        channelId: 'whisper',
        type: 'WHISPER',
        recipientUserId: context.gmUserId,
        payload: { text, recipientUserId: context.gmUserId },
      },
    }
  },
})

// /heal (sans argument) : personnages avec un token sur la carte actuelle du groupe.
// /heal all : tous les personnages de la campagne. Portée volontairement large — PJ + PNJ + exo + drone
// (décision Saar 2026-09-04, docs/PLANS/PLAN_CHAT_COMMANDES.md §4). Strictement 'gm' — jamais de repli
// sur users.role==='admin' (.claude/rules/core.md).
// context.healCharacters(scope) -> { count, noMap? } — fourni par socketChat.js (orchestration DB/IO,
// ce module ne touche jamais la DB directement, même patron que findCampaignMemberByUsername/gmUserId
// ci-dessus). La réponse est un message système public (senderUserId: null), pas une réponse privée —
// tous les joueurs voient qu'un /heal a eu lieu, décision Saar 2026-09-04.
chatCommandRegistry.register({
  name: 'heal',
  descriptionKey: 'chat.commands.heal.description',
  permission: 'gm',
  async execute(context, args) {
    const scope = args[0]?.toLowerCase() === 'all' ? 'campaign' : 'map'
    const result = await context.healCharacters(scope)
    if (result.noMap) {
      return { reply: { i18nKey: 'chat.commands.heal.noActiveMap' } }
    }
    return {
      send: {
        channelId: 'general',
        type: 'SYSTEM',
        senderUserId: null,
        payload: { i18nKey: 'chat.commands.heal.done', params: { count: result.count } },
      },
    }
  },
})

// Parsing pur (aucun accès DB, cohérent avec le reste de ce module) : @<personnage> optionnel en
// premier argument (fallback de désambiguïsation, cf. resolveSkillTestCommand), dernier argument
// optionnel ^[+-]?\d+$ = modificateur de Seuil signé (RAW : positif = bonus, négatif = malus, ajouté
// directement au Seuil — socketEntity.js:322-323, convention déjà vérifiée dans le projet), tout le
// reste joint = nom de compétence (peut contenir espaces/parenthèses, ex. "Pilotage (Terrestre)").
function parseSkillTestArgs(args) {
  let rest = args
  let targetName = null
  if (rest[0]?.startsWith('@')) {
    targetName = rest[0].slice(1)
    rest = rest.slice(1)
  }
  let difficulty = 0
  const last = rest[rest.length - 1]
  if (last && /^[+-]?\d+$/.test(last)) {
    difficulty = parseInt(last, 10)
    rest = rest.slice(0, -1)
  }
  return { targetName, skillName: rest.join(' '), difficulty }
}

// /t <compétence> [difficulté] — jet immédiat, sans validation MJ (décision Saar 2026-09-04, écarte le
// flux d'arbitrage existant). /t @<personnage> <compétence> [difficulté] désambiguïse si le joueur a
// plus d'un personnage dans la campagne (techniquement possible, n'arrive jamais en pratique — Saar).
// Cible toujours un personnage du joueur qui tape la commande, jamais un tiers.
// context.rollSkillTest({targetName, skillName, difficulty}) -> { error?, params? } — fourni par
// socketChat.js (orchestration DB/IO/broadcast, resolveSkillTestCommand — ce module ne touche jamais la
// DB directement, même patron que healCharacters ci-dessus).
chatCommandRegistry.register({
  name: 't',
  descriptionKey: 'chat.commands.t.description',
  permission: 'player',
  async execute(context, args) {
    const { targetName, skillName, difficulty } = parseSkillTestArgs(args)
    if (!skillName) return { reply: { i18nKey: 'chat.commands.t.usage' } }
    const result = await context.rollSkillTest({ targetName, skillName, difficulty })
    if (result.error) return { reply: { i18nKey: result.error, params: result.params } }
    return { handled: true }
  },
})
