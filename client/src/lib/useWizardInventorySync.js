import { useEffect } from 'react'
import { useSocket } from './SocketContext.jsx'
import { WS } from '../../../shared/events.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { refreshDerivedTotals } from './inventoryDataSync.js'

// Synchronisation live d'InventoryPanel dans le Wizard (docs/PLAN_WIZARD_MATERIEL.md §4,
// PLAN_INVENTORY_UX.md §3.4 point 3). InventoryPanel.jsx lit characterStore par sélecteur
// (useInventoryData.js) — ce hook écrit dans le même store, appelé depuis un composant réellement
// descendant de <SocketProvider> (StepMaterielEtBiens.jsx) — pas besoin du contournement par ref
// qu'utilise WizardCreation.jsx (lui rend le Provider, n'en est pas descendant).
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
  const upsertInventoryItem = useCharacterStore(s => s.upsertInventoryItem)
  const removeInventoryItem = useCharacterStore(s => s.removeInventoryItem)
  const setSols = useCharacterStore(s => s.setSols)

  useEffect(() => {
    if (!socket || !characterId) return

    // La garde "déjà suivi" avant refreshDerivedTotals est portée par upsertInventoryItem/
    // removeInventoryItem elles-mêmes (no-op sinon, characterStore.js).
    const onAdded = ({ characterId: cid, item }) => {
      if (cid !== characterId || !item) return
      upsertInventoryItem(characterId, item)
      if (useCharacterStore.getState().inventoryByCharId[characterId] !== undefined) {
        refreshDerivedTotals(characterId)
      }
    }
    const onUpdated = ({ characterId: cid, item }) => {
      if (cid !== characterId || !item) return
      upsertInventoryItem(characterId, item)
      if (useCharacterStore.getState().inventoryByCharId[characterId] !== undefined) {
        refreshDerivedTotals(characterId)
      }
    }
    const onRemoved = ({ characterId: cid, itemId }) => {
      if (cid !== characterId || !itemId) return
      removeInventoryItem(characterId, itemId)
      if (useCharacterStore.getState().inventoryByCharId[characterId] !== undefined) {
        refreshDerivedTotals(characterId)
      }
    }
    const onSolsUpdated = ({ characterId: cid, sols }) => {
      if (cid !== characterId) return
      setSols(characterId, sols)
    }

    socket.on(WS.INVENTORY_ADDED, onAdded)
    socket.on(WS.INVENTORY_UPDATED, onUpdated)
    socket.on(WS.INVENTORY_REMOVED, onRemoved)
    socket.on(WS.SOLS_UPDATED, onSolsUpdated)

    return () => {
      socket.off(WS.INVENTORY_ADDED, onAdded)
      socket.off(WS.INVENTORY_UPDATED, onUpdated)
      socket.off(WS.INVENTORY_REMOVED, onRemoved)
      socket.off(WS.SOLS_UPDATED, onSolsUpdated)
    }
  }, [socket, characterId, upsertInventoryItem, removeInventoryItem, setSols])
}
