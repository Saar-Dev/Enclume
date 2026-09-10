import { useEffect, useRef } from 'react'
import api from './api'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { useSessionStore } from '../stores/sessionStore'

// docs/PLANS/PLAN_USURE&INTEGRITE.md §8 (L6c-A) — hook MJ, toujours monté (SessionPage).
// Injecte / retire les cartes d'action « demande de réparation » (type 'repair_request') dans le
// chat, à partir de la vérité serveur (statut de l'échéance game_echeances). Patron useEntitySocket.
//
// Pourquoi un hook et pas un panneau : la carte d'action est le bon patron du projet (sidebar-msg-
// action, cf. entity_action / sell_request). Mais sell_request ne se re-dérive pas à la reconnexion
// (son filet est la TradeWindow persistante) ; ici il n'y a pas d'autre filet, donc ce hook
// reconstruit les cartes au montage via GET repair-requests. Le retrait de carte à la résolution
// (removeMessage) est une aggradation vs entity_action / sell_request qui laissent une carte morte.
//
// - montage / reconnexion : reconcile() — GET repair-requests, addMessage pour chaque
//   pending_mj_review absent, removeMessage pour chaque carte dont l'échéance n'est plus en attente.
// - EQUIPMENT_REPAIR_REQUESTED (temps réel, payload enrichi) : addMessage direct si les options sont
//   déjà chargées, sinon reconcile().
// - EQUIPMENT_REPAIR_UPDATED (demande approuvée / refusée / jet résolu) : reconcile().
// - GAME_ECHEANCE_RESOLVED { echeanceId } : reconcile() seulement si la carte existe (évite un GET
//   inutile à chaque résolution de blessure).
export function useRepairRequestSocket({ campaignId, isGm }) {
  const socket = useSocket()
  const addMessage = useSessionStore(s => s.addMessage)
  const removeMessage = useSessionStore(s => s.removeMessage)
  const optionsRef = useRef([])
  const injectedRef = useRef(new Set())

  useEffect(() => {
    if (!socket || !isGm || !campaignId) return

    const msgId = (echeanceId) => `repair-request-${echeanceId}`
    const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    // `e` peut venir du payload EQUIPMENT_REPAIR_REQUESTED (echeanceId, playerName, itemName…) ou d'une
    // ligne enrichie de GET repair-requests (id, characterName, item.name, suggestedSkill*).
    const inject = (e) => {
      const echeanceId = e.echeanceId ?? e.id
      addMessage({
        id: msgId(echeanceId),
        type: 'repair_request',
        gmOnly: true,
        echeanceId,
        playerName: e.playerName ?? e.characterName ?? '',
        itemName: e.itemName ?? e.item?.name ?? '',
        suggestedSkillId: e.suggestedSkillId ?? null,
        suggestedSkillLabel: e.suggestedSkillLabel ?? null,
        repairSkillOptions: optionsRef.current,
        time: now(),
      })
      injectedRef.current.add(echeanceId)
    }

    const reconcile = async () => {
      try {
        const { data } = await api.get(`/campaigns/${campaignId}/game-echeances/repair-requests`)
        optionsRef.current = data.repairSkillOptions || []
        const pending = (data.echeances || []).filter(e => e.status === 'pending_mj_review')
        const pendingIds = new Set(pending.map(e => e.id))
        for (const e of pending) {
          if (!injectedRef.current.has(e.id)) inject(e)
        }
        for (const id of [...injectedRef.current]) {
          if (!pendingIds.has(id)) {
            removeMessage(campaignId, msgId(id))
            injectedRef.current.delete(id)
          }
        }
      } catch (err) {
        console.error('[useRepairRequestSocket] reconcile:', err.message)
      }
    }

    const onRequested = (payload) => {
      if (optionsRef.current.length) inject(payload)
      else reconcile()
    }
    const onUpdated = () => reconcile()
    const onResolved = ({ echeanceId }) => {
      if (injectedRef.current.has(echeanceId)) reconcile()
    }

    reconcile()
    socket.on(WS.EQUIPMENT_REPAIR_REQUESTED, onRequested)
    socket.on(WS.EQUIPMENT_REPAIR_UPDATED, onUpdated)
    socket.on(WS.GAME_ECHEANCE_RESOLVED, onResolved)
    return () => {
      socket.off(WS.EQUIPMENT_REPAIR_REQUESTED, onRequested)
      socket.off(WS.EQUIPMENT_REPAIR_UPDATED, onUpdated)
      socket.off(WS.GAME_ECHEANCE_RESOLVED, onResolved)
    }
  }, [socket, isGm, campaignId, addMessage, removeMessage])
}
