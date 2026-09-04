import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { useSessionStore } from '../stores/sessionStore'
import api from './api.js'
import { normalizeMessage } from './normalizeChatMessage.js'

const HISTORY_LIMIT = 50
// Un whisper vit dans un canal séparé côté API (chatRepository.getMessages filtre par channel_id) —
// sans charger les deux, il disparaîtrait de la vue "classique" au premier chargement (PLAN_CHAT.md
// §15 : pas de canaux visibles en V1, tout se mélange dans un seul flux chronologique).
const CHANNELS = ['general', 'whisper']

async function fetchChannelPage(campaignId, channelId, cursor) {
  const { data } = await api.get(`/campaigns/${campaignId}/chat/messages`, {
    params: { channelId, limit: HISTORY_LIMIT, ...cursor },
  })
  return data
}

// useChatSocket — hook unifié (PLAN_CHAT.md §8.1). Charge l'historique persisté au montage (§8.4),
// écoute chat:message_created/_deleted, expose loadOlderMessages pour le scroll infini (§8.5).
// Le rendu des messages TEXT/WHISPER (forme différente des autres types du flux — dés, système...)
// est la responsabilité de MessageRendererRegistry.js (Phase 3d) ; ce hook ne fait qu'acheminer les
// données dans sessionStore, ne rend rien lui-même.
//
// Pas encore appelé nulle part (Phase 3c) — Sidebar.jsx bascule dessus en Phase 3e.
export function useChatSocket(campaignId) {
  const socket = useSocket()
  const { t } = useTranslation()
  const { setMessages, prependMessages, addMessage, removeMessage } = useSessionStore()
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  // Curseur + hasMore par canal — le scroll infini doit continuer de paginer 'general' même après
  // épuisement de 'whisper' (ou l'inverse), pas s'arrêter au premier des deux qui se tarit.
  const channelStateRef = useRef({
    general: { cursor: undefined, hasMore: true },
    whisper: { cursor: undefined, hasMore: true },
  })

  // ─── Historique initial ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    ;(async () => {
      try {
        const pages = await Promise.all(CHANNELS.map(ch => fetchChannelPage(campaignId, ch)))
        if (cancelled) return
        const merged = []
        pages.forEach((page, i) => {
          channelStateRef.current[CHANNELS[i]] = {
            cursor: page.pagination.nextCursor,
            hasMore: page.pagination.hasMore,
          }
          merged.push(...page.messages.map(normalizeMessage))
        })
        merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        setHasMore(CHANNELS.some(ch => channelStateRef.current[ch].hasMore))
        setMessages(campaignId, 'general', merged)
      } catch (err) {
        console.error('[Chat] Erreur chargement historique :', err)
      }
    })()
    return () => { cancelled = true }
  }, [campaignId, setMessages])

  // ─── Temps réel ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    // Réponse de commande (/help, usage /w...) — socketChat.js l'émet aussi via
    // CHAT_MESSAGE_CREATED (system:true, i18nKey/params/timestamp bruts, jamais persistée),
    // même mécanisme de résolution que COMBAT_SYSTEM_NOTICE (useSessionSocket.js).
    //
    // chat.commands.help.list est un cas particulier : params.commands est une liste dynamique
    // ({name, descriptionKey}), et i18next ne boucle pas dans une seule chaîne t() — ce texte est donc
    // construit ici plutôt que résolu par un t() plat (PLAN_CHAT_COMMANDES.md §3). renderSystem
    // (MessageRendererRegistry.jsx) affiche text sans white-space:pre-line, d'où une seule ligne
    // (séparateur " · ") plutôt qu'un texte multi-lignes qui ne s'afficherait pas comme attendu.
    const onCreated = (message) => {
      if (message.system) {
        const text = message.i18nKey === 'chat.commands.help.list'
          ? [
              t('chat.commands.help.intro'),
              ...message.params.commands.map(cmd => `/${cmd.name} — ${t(cmd.descriptionKey)}`),
            ].join(' · ')
          : t(message.i18nKey, message.params)
        addMessage({
          id: `sys-${message.i18nKey}-${message.timestamp}`, system: true,
          text,
          time: new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })
        return
      }
      addMessage(message)
    }
    const onDeleted = ({ id }) => removeMessage(campaignId, id)
    socket.on(WS.CHAT_MESSAGE_CREATED, onCreated)
    socket.on(WS.CHAT_MESSAGE_DELETED, onDeleted)
    return () => {
      socket.off(WS.CHAT_MESSAGE_CREATED, onCreated)
      socket.off(WS.CHAT_MESSAGE_DELETED, onDeleted)
    }
  }, [socket, campaignId, addMessage, removeMessage, t])

  // ─── Scroll infini — pagination ascendante sur les deux canaux, fusionnée ──────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (!campaignId || loadingOlder) return
    const pending = CHANNELS.filter(ch => channelStateRef.current[ch].hasMore)
    if (pending.length === 0) return
    setLoadingOlder(true)
    try {
      const pages = await Promise.all(
        pending.map(ch => fetchChannelPage(campaignId, ch, channelStateRef.current[ch].cursor)),
      )
      const merged = []
      pages.forEach((page, i) => {
        channelStateRef.current[pending[i]] = {
          cursor: page.pagination.nextCursor,
          hasMore: page.pagination.hasMore,
        }
        merged.push(...page.messages.map(normalizeMessage))
      })
      merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      setHasMore(CHANNELS.some(ch => channelStateRef.current[ch].hasMore))
      prependMessages(campaignId, 'general', merged)
    } catch (err) {
      console.error('[Chat] Erreur chargement page précédente :', err)
    } finally {
      setLoadingOlder(false)
    }
  }, [campaignId, loadingOlder, prependMessages])

  return { loadOlderMessages, loadingOlder, hasMore }
}
