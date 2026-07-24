import { useEffect, useState } from 'react'
import { useSocket } from './SocketContext.jsx'
import { WS } from '../../../shared/events.js'

// Rafraîchissement live d'InventoryPanel dans le Wizard (docs/PLAN_WIZARD_MATERIEL.md §4).
// InventoryPanel.jsx n'a aucun listener socket propre — il dépend d'un `reloadKey` fourni par son
// parent (dans la fiche permanente, useCharacterSocket.js, monté uniquement à SessionPage.jsx, jamais
// dans l'arbre du Wizard). Même mécanisme ici, appelé depuis un composant réellement descendant de
// <SocketProvider> (StepMaterielEtBiens.jsx) — pas besoin du contournement par ref qu'utilise
// WizardCreation.jsx (lui rend le Provider, n'en est pas descendant).
//
// Pas de garde useSocketReady() ici (contrairement à useWizardLiveEmit.js) : ce hook n'émet rien, il
// écoute seulement — même patron que useCharacterSocket.js, qui ne garde que `if (!socket) return`.
// La garde `ready` des hooks Wizard existe pour un problème différent (émettre avant que le serveur
// ait posé ses listeners), non applicable à un simple abonnement.
//
// Filtre par characterId obligatoire : Socket.IO ne filtre pas côté client par room — ce socket est
// aussi membre de la room de campagne (SESSION_JOIN), il reçoit donc aussi les événements inventaire
// d'autres personnages sans rapport avec ce brouillon.
export function useWizardInventorySync(characterId) {
  const socket = useSocket()
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!socket || !characterId) return

    const bump = (payload) => {
      if (payload.characterId !== characterId) return
      setReloadKey(k => k + 1)
    }

    socket.on(WS.INVENTORY_ADDED, bump)
    socket.on(WS.INVENTORY_UPDATED, bump)
    socket.on(WS.INVENTORY_REMOVED, bump)

    return () => {
      socket.off(WS.INVENTORY_ADDED, bump)
      socket.off(WS.INVENTORY_UPDATED, bump)
      socket.off(WS.INVENTORY_REMOVED, bump)
    }
  }, [socket, characterId])

  return reloadKey
}
