import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { useSessionStore } from '../stores/sessionStore'
import { useCharacterStore } from '../stores/characterStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useCampaignStore } from '../stores/campaignStore'

export function useSessionSocket() {
  const socket = useSocket()
  const { setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage } = useSessionStore()
  const { upsertCharacter } = useCharacterStore()
  const { addDocument, updateDocument, removeDocument } = useLibraryStore()
  const { updateCampaign } = useCampaignStore()
  const { t } = useTranslation()

  const [lastDiceRoll, setLastDiceRoll] = useState(null)
  const [gmSocketError, setGmSocketError] = useState(null)

  useEffect(() => {
    if (!socket) return

    const onSessionJoined = ({ userId, onlineUserIds = [] }) =>
      setOnlineUsers(new Set([userId, ...onlineUserIds]))
    const onUserJoined = ({ userId, username }) => {
      addOnlineUser(userId)
      addMessage({
        id: `sys-join-${userId}-${Date.now()}`, system: true,
        text: t('session.userJoined', { username }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
    const onUserLeft = ({ userId, username }) => {
      removeOnlineUser(userId)
      addMessage({
        id: `sys-left-${userId}-${Date.now()}`, system: true,
        text: t('session.userLeft', { username }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
    const onCampaignUpdated = ({ campaign: updated }) => updateCampaign(updated)
    // system:true (COM29, dual-wield dégradé) — message serveur porté par une clé i18n, jamais un
    // texte figé (même mécanisme que les messages système join/leave ci-dessus), résolue ici pour
    // rester cohérent avec la langue active du client qui l'affiche.
    const onChatMessage = (payload) => {
      if (payload.system) {
        addMessage({
          id: `sys-${payload.i18nKey}-${payload.timestamp}`, system: true,
          text: t(payload.i18nKey),
          time: new Date(payload.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })
        return
      }
      const { userId, username, color, text, timestamp } = payload
      addMessage({
        id: `${userId}-${timestamp}`, user: username, color, text,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
    const onCharacterUpdated = (updatedCharacter) => upsertCharacter(updatedCharacter)
    const onDiceResult = ({ userId, username, color, formula, rolls, total,
      isCriticalSuccess, isCriticalFail, seed, timestamp, skillLabel, mechanicalTotal,
      chancesDeReussite, diffLabel, isSuccess, interactionType, mr, targetName,
      localisation, severity, severityColor, secret, breakdown }) => {
      addMessage({
        id: `dice-${userId}-${timestamp}`, type: 'dice', user: username, color,
        formula, rolls, total, isCriticalSuccess, isCriticalFail,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess,
        interactionType, mr, targetName, localisation, severity, severityColor,
        secret: secret || false, breakdown,
      })
      if (skillLabel === undefined) {
        setLastDiceRoll({ rolls, dieType: formula.replace(/^\d+/, '').split('+')[0].split('-')[0], seed, timestamp, color })
      }
    }
    const onMacroRollResult = ({ characterName, color, sourceLabel, rollResult, threshold,
      isSuccess, isCriticalSuccess, isCriticalFail, formattedMessage, secret, timestamp }) =>
      addMessage({
        id: `macro-${timestamp}`, type: 'dice', interactionType: 'macro_result',
        characterName, color, sourceLabel, rollResult, threshold, isSuccess,
        isCriticalSuccess, isCriticalFail, formattedMessage, secret: secret || false,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    const onError = (err) => {
      const msg = err?.message ?? String(err)
      console.error('[WS] Erreur serveur:', msg)
      setGmSocketError(msg)
    }
    const onDocCreated  = (doc)      => addDocument(doc)
    const onDocUpdated  = (doc)      => updateDocument(doc)
    const onDocDeleted  = ({ id })   => removeDocument(id)

    socket.on(WS.SESSION_JOINED,            onSessionJoined)
    socket.on(WS.SESSION_USER_JOINED,       onUserJoined)
    socket.on(WS.SESSION_USER_LEFT,         onUserLeft)
    socket.on(WS.CAMPAIGN_SETTINGS_UPDATED, onCampaignUpdated)
    socket.on(WS.CHAT_MESSAGE,              onChatMessage)
    socket.on(WS.CHARACTER_UPDATED,         onCharacterUpdated)
    socket.on(WS.DICE_RESULT,               onDiceResult)
    socket.on(WS.MACRO_ROLL_RESULT,         onMacroRollResult)
    socket.on('error',                      onError)
    socket.on(WS.DOC_CREATED,              onDocCreated)
    socket.on(WS.DOC_UPDATED,              onDocUpdated)
    socket.on(WS.DOC_DELETED,              onDocDeleted)

    return () => {
      socket.off(WS.SESSION_JOINED,            onSessionJoined)
      socket.off(WS.SESSION_USER_JOINED,       onUserJoined)
      socket.off(WS.SESSION_USER_LEFT,         onUserLeft)
      socket.off(WS.CAMPAIGN_SETTINGS_UPDATED, onCampaignUpdated)
      socket.off(WS.CHAT_MESSAGE,              onChatMessage)
      socket.off(WS.CHARACTER_UPDATED,         onCharacterUpdated)
      socket.off(WS.DICE_RESULT,               onDiceResult)
      socket.off(WS.MACRO_ROLL_RESULT,         onMacroRollResult)
      socket.off('error',                      onError)
      socket.off(WS.DOC_CREATED,              onDocCreated)
      socket.off(WS.DOC_UPDATED,              onDocUpdated)
      socket.off(WS.DOC_DELETED,              onDocDeleted)
    }
  }, [socket])

  return { lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError }
}
