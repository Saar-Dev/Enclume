// chatCommands.js — docs/PLANS/PLAN_CHAT.md §5.6. Registre de commandes slash.
//
// Portée V1 réelle (§15 "Hors scope V1" : "/r migré vers le Command Registry (reste dans
// Sidebar.jsx en attendant)") : /r et son alias /roll restent sur le flux DICE_ROLL existant, hors
// de ce registre — l'exemple de code §5.6 qui les enregistre ici est une illustration du design
// cible, pas la portée V1. Seuls /help, /w, /gm sont réellement enregistrés.
//
// i18n (.claude/rules/i18n.md, chargée en écrivant ce fichier) : "le serveur n'émet jamais de texte
// FR figé destiné à l'utilisateur" — pattern system:true + i18nKey (socketCombatHelpers.js,
// useSessionSocket.js). Aucune des chaînes retournées ici n'est un texte final : ce sont des clés
// i18n sous le namespace `chat.commands.*`, à créer dans client/src/locales/ en Phase 3 (rendu
// client) — pas maintenant, ce module n'émet rien tant qu'il n'est pas branché dans socketChat.js.
//
// Contrat execute(context, args) : retourne soit { reply: { i18nKey, params? } } (réponse privée non
// persistée), soit { send: { channelId, type, payload, recipientUserId } } (intention de message à
// transmettre par l'appelant à chatService.sendMessage). Ce module ne touche jamais la DB ni
// chatService directement — l'orchestration reste dans socketChat.js, qui construit le `context`
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
