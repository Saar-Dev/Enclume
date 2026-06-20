import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useAuthStore } from '../stores/authStore'
import { useSessionStore } from '../stores/sessionStore'
import { useMapStore } from '../stores/mapStore'
import { useTokenStore } from '../stores/tokenStore'
import { useEntityStore } from '../stores/entityStore'
import api from './api'

export function useEntitySocket({ setRadialMenu, setMoveTarget }) {
  const { user } = useAuthStore()
  const { clearPendingEntityId, addMessage } = useSessionStore()
  const { setBattlemap } = useMapStore()
  const { setTokens } = useTokenStore()
  const { setEntities } = useEntityStore()
  const { t } = useTranslation()

  function listen(s) {
    s.on(WS.MAP_SWITCH, ({ battlemapId, userIds }) => {
      const concerned = userIds.length === 0 || userIds.includes(user?.id)
      if (!concerned) return
      api.get(`/battlemaps/${battlemapId}`)
        .then(res => {
          setBattlemap(res.data.battlemap)
          setTokens(res.data.tokens || [])
          return api.get(`/battlemaps/${battlemapId}/entities`)
        })
        .then(res => setEntities(res.data.entities || []))
        .catch(err => console.error('Erreur chargement carte MAP_SWITCH :', err))
    })

    s.on(WS.ENTITY_ACTION_PENDING, (pending) => {
      addMessage({
        id: `entity-action-${pending.requestId}`,
        type: 'entity_action',
        gmOnly: true,
        requestId: pending.requestId,
        playerName: pending.playerName,
        interactionLabel: pending.interactionLabel,
        entityLabel: pending.entityLabel,
        skillId: pending.skillId,
        skillTotal: pending.skillTotal,
        defaultDifficulty: pending.defaultDifficulty,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })

    s.on(WS.ENTITY_ACTION_RESULT, ({ requestId, isApproved, reason }) => {
      clearPendingEntityId()
      if (!isApproved) {
        const reasonText = reason === 'timeout'
          ? t('session.actionExpired')
          : reason === 'no_gm'
            ? t('session.noGm')
            : t('session.actionRefused')
        addMessage({
          id: `entity-result-${requestId}`,
          system: true,
          text: reasonText,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })
      }
      setRadialMenu(null)
    })

    s.on(WS.ENTITY_MOVE_RESULT, ({ mr, dmax, success }) => {
      setMoveTarget(null)
      addMessage({
        id: `move-result-${Date.now()}`,
        system: true,
        text: success
          ? t('entity.moveSuccess', { mr, dmax })
          : t('entity.moveFail', { mr }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })

    s.on(WS.DICE_RESULT, ({ type }) => {
      if (type !== 'entity_action') return
      clearPendingEntityId()
    })
  }

  return { listen }
}
