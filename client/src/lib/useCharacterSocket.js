import { useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCharacterStore } from '../stores/characterStore'
import { useSocket } from './SocketContext'
import { refreshDerivedTotals } from './inventoryDataSync.js'
import api from './api.js'

export function useCharacterSocket() {
  const socket = useSocket()
  const { updateCharacter } = useCharacterStore()
  const setWounds = useCharacterStore(s => s.setWounds)
  const upsertInventoryItem = useCharacterStore(s => s.upsertInventoryItem)
  const removeInventoryItem = useCharacterStore(s => s.removeInventoryItem)
  const setSols = useCharacterStore(s => s.setSols)
  const setGauge = useCharacterStore(s => s.setGauge)

  useEffect(() => {
    if (!socket) return

    const onWoundAdded = ({ characterId, worst_wound_severity }) => {
      updateCharacter({ id: characterId, worst_wound_severity })
      api.get(`/char-sheet/${characterId}/wounds`)
        .then(res => setWounds(characterId, res.data.wounds || []))
        .catch(() => {})
    }
    const onWoundUpdated = ({ characterId, worst_wound_severity }) => {
      if (!characterId) return
      updateCharacter({ id: characterId, worst_wound_severity })
      api.get(`/char-sheet/${characterId}/wounds`)
        .then(res => setWounds(characterId, res.data.wounds || []))
        .catch(() => {})
    }
    const onWoundRemoved = ({ characterId, worst_wound_severity }) => {
      if (!characterId) return
      updateCharacter({ id: characterId, worst_wound_severity })
      api.get(`/char-sheet/${characterId}/wounds`)
        .then(res => setWounds(characterId, res.data.wounds || []))
        .catch(() => {})
    }
    // PLAN_INVENTORY_UX.md Étape 0 — écriture directe dans characterStore (source unique de vérité,
    // ArmorWoundPanel/WeaponPanel/InventoryPanel lisent via useInventoryData.js). refreshDerivedTotals
    // (poids/malus recalculés côté serveur) n'est déclenché que si ce characterId est déjà suivi par ce
    // client (quelqu'un a son onglet Matériel ouvert ici) — upsertInventoryItem est lui-même un no-op
    // sinon (characterStore.js), donc la garde après l'upsert est fiable.
    const onInventoryAdded = ({ characterId, item }) => {
      if (!characterId || !item) return
      upsertInventoryItem(characterId, item)
      if (useCharacterStore.getState().inventoryByCharId[characterId] !== undefined) {
        refreshDerivedTotals(characterId)
      }
    }
    const onInventoryUpdated = ({ characterId, item }) => {
      if (!characterId || !item) return
      upsertInventoryItem(characterId, item)
      if (useCharacterStore.getState().inventoryByCharId[characterId] !== undefined) {
        refreshDerivedTotals(characterId)
      }
    }
    const onInventoryRemoved = ({ characterId, itemId }) => {
      if (!characterId || !itemId) return
      removeInventoryItem(characterId, itemId)
      if (useCharacterStore.getState().inventoryByCharId[characterId] !== undefined) {
        refreshDerivedTotals(characterId)
      }
    }
    // PLAN_INVENTORY_UX.md §3.3 — jusqu'ici émis par le serveur mais écouté par aucun client (sols ne
    // se rafraîchissait qu'au prochain fetch complet d'InventoryPanel). Écrit directement dans le store.
    const onSolsUpdated = ({ characterId, sols }) => {
      if (characterId) setSols(characterId, sols)
    }
    // PLAN_WIZARD_MATERIEL_GAUGES.md §6 — écriture directe, même patron que onSolsUpdated.
    const onGaugeUpdated = ({ characterId, categoryKey, value }) => {
      if (characterId) setGauge(characterId, categoryKey, value)
    }

    socket.on(WS.WOUND_ADDED,       onWoundAdded)
    socket.on(WS.WOUND_UPDATED,     onWoundUpdated)
    socket.on(WS.WOUND_REMOVED,     onWoundRemoved)
    socket.on(WS.INVENTORY_ADDED,   onInventoryAdded)
    socket.on(WS.INVENTORY_UPDATED, onInventoryUpdated)
    socket.on(WS.INVENTORY_REMOVED, onInventoryRemoved)
    socket.on(WS.SOLS_UPDATED,      onSolsUpdated)
    socket.on(WS.GAUGE_UPDATED,     onGaugeUpdated)

    return () => {
      socket.off(WS.WOUND_ADDED,       onWoundAdded)
      socket.off(WS.WOUND_UPDATED,     onWoundUpdated)
      socket.off(WS.WOUND_REMOVED,     onWoundRemoved)
      socket.off(WS.INVENTORY_ADDED,   onInventoryAdded)
      socket.off(WS.INVENTORY_UPDATED, onInventoryUpdated)
      socket.off(WS.INVENTORY_REMOVED, onInventoryRemoved)
      socket.off(WS.SOLS_UPDATED,      onSolsUpdated)
      socket.off(WS.GAUGE_UPDATED,     onGaugeUpdated)
    }
  }, [socket])
  // [socket] uniquement — updateCharacter, setWounds, upsertInventoryItem, removeInventoryItem, setSols,
  // setGauge (actions Zustand) sont des références stables, non listées dans les deps (même pattern que
  // useTokenSocket).
}
