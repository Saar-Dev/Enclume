// chatBroadcast.js — docs/PLANS/PLAN_CHAT.md §5.5. Diffusion d'un message persisté vers les
// sockets concernés. Partagé entre chatRoutes.js (REST) et socketChat.js (WS) — même règle de
// visibilité quelle que soit la voie d'entrée (core.md : "REST et Socket.IO d'une même
// fonctionnalité partagent le même service métier autoritaire").
import { WS } from '../../../shared/events.js'

// Un whisper (§16, recipient_user_id) n'est jamais diffusé à toute la room campagne — seuls
// l'expéditeur et le destinataire le reçoivent.
export async function broadcastMessageCreated(io, campaignId, message) {
  if (message.channelId === 'whisper') {
    const sockets = await io.in(campaignId).fetchSockets()
    const targets = sockets.filter((s) => (
      s.data.userId === message.author?.id || s.data.userId === message.recipientUserId
    ))
    for (const s of targets) s.emit(WS.CHAT_MESSAGE_CREATED, message)
    return
  }
  io.to(campaignId).emit(WS.CHAT_MESSAGE_CREATED, message)
}

// Simplification V1 assumée : notifie toute la room même pour un whisper supprimé. Un filtrage
// symétrique au create nécessiterait de connaître sender/recipient au moment du delete (non
// retourné par chatService.deleteMessage aujourd'hui) — sans risque de fuite (payload = id +
// channelId seuls, jamais le texte), un client qui n'a jamais reçu ce message ignore un id inconnu.
export function broadcastMessageDeleted(io, campaignId, { id, channelId }) {
  io.to(campaignId).emit(WS.CHAT_MESSAGE_DELETED, { id, channelId })
}
