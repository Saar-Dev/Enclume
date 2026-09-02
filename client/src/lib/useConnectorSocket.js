import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSocket } from './SocketContext'
import { WS } from '../../../shared/events.js'
import { useSessionStore } from '../stores/sessionStore'

// Fichier dédié plutôt qu'une extension de useEntitySocket.js (déjà dense) —
// docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md §5/§8. Mirroir exact des 3 listeners entité pertinents
// (onEntityActionPending/onEntityActionResult/le filtre `type` de onDiceResult, useEntitySocket.js) :
// raisons de refus réutilisées telles quelles depuis le namespace `session.*` de fr.json, déjà
// génériques (aucune ne mentionne "entité" dans le libellé) — pas de nouvelle clé i18n nécessaire ici.
export function useConnectorSocket() {
  const socket = useSocket()
  const { clearPendingConnectorId, addMessage } = useSessionStore()
  const { t } = useTranslation()

  useEffect(() => {
    if (!socket) return

    const onConnectorActionPending = (pending) => {
      addMessage({
        id: `connector-action-${pending.requestId}`,
        type: 'connector_action',
        gmOnly: true,
        requestId: pending.requestId,
        playerName: pending.playerName,
        characterName: pending.characterName,
        connectorLabel: pending.connectorLabel,
        skillId: pending.skillId,
        defaultDifficulty: pending.defaultDifficulty,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }

    // Uniquement le chemin de refus (isApproved: false) — un succès (no-op, branche libre, override
    // MJ) ne pousse aucun message ici, la porte qui change d'état à l'écran est déjà le retour visuel
    // (même choix que ENTITY_ACTION_RESULT, jamais de 2e signal redondant).
    const onConnectorActionResult = ({ requestId, isApproved, reason }) => {
      clearPendingConnectorId()
      if (isApproved) return
      const reasonText = reason === 'timeout'
        ? t('session.actionExpired')
        : reason === 'no_gm'
          ? t('session.noGm')
          : reason === 'mortally_wounded'
            ? t('session.mortallyWoundedNoTest')
            : reason === 'out_of_range'
              ? t('session.actionOutOfRange')
              : t('session.actionRefused')
      addMessage({
        id: `connector-result-${requestId}`,
        system: true,
        text: reasonText,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }

    // Le succès d'une tentative de crochetage (branche Test) n'émet jamais de 2e
    // CONNECTOR_ACTION_RESULT (mirroir socketConnector.js#CONNECTOR_ACTION_RESOLVE) — seul DICE_RESULT
    // signale la fin de la résolution, d'où ce 2e écouteur pour lever le pending dans ce cas précis.
    const onDiceResult = ({ type }) => {
      if (type !== 'connector_action') return
      clearPendingConnectorId()
    }

    socket.on(WS.CONNECTOR_ACTION_PENDING, onConnectorActionPending)
    socket.on(WS.CONNECTOR_ACTION_RESULT, onConnectorActionResult)
    socket.on(WS.DICE_RESULT, onDiceResult)

    return () => {
      socket.off(WS.CONNECTOR_ACTION_PENDING, onConnectorActionPending)
      socket.off(WS.CONNECTOR_ACTION_RESULT, onConnectorActionResult)
      socket.off(WS.DICE_RESULT, onDiceResult)
    }
  }, [socket, clearPendingConnectorId, addMessage, t])
  // Pas de return — aucun état exposé, mirroir useEntitySocket.js
}
