import { useState, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCharacterStore } from '../stores/characterStore'
import { useSocket } from './SocketContext'
import api from './api.js'

export function useCharacterSocket() {
  const socket = useSocket()
  const { updateCharacter } = useCharacterStore()
  const setWounds = useCharacterStore(s => s.setWounds)
  const [woundVersions, setWoundVersions] = useState({})

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
    const onInventoryAdded = ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    }
    const onInventoryUpdated = ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    }
    const onInventoryRemoved = ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    }

    socket.on(WS.WOUND_ADDED,       onWoundAdded)
    socket.on(WS.WOUND_UPDATED,     onWoundUpdated)
    socket.on(WS.WOUND_REMOVED,     onWoundRemoved)
    socket.on(WS.INVENTORY_ADDED,   onInventoryAdded)
    socket.on(WS.INVENTORY_UPDATED, onInventoryUpdated)
    socket.on(WS.INVENTORY_REMOVED, onInventoryRemoved)

    return () => {
      socket.off(WS.WOUND_ADDED,       onWoundAdded)
      socket.off(WS.WOUND_UPDATED,     onWoundUpdated)
      socket.off(WS.WOUND_REMOVED,     onWoundRemoved)
      socket.off(WS.INVENTORY_ADDED,   onInventoryAdded)
      socket.off(WS.INVENTORY_UPDATED, onInventoryUpdated)
      socket.off(WS.INVENTORY_REMOVED, onInventoryRemoved)
    }
  }, [socket])
  // [socket] uniquement — updateCharacter, setWounds (Zustand actions) et setWoundVersions (setter useState)
  // sont des références stables, non listées dans les deps (même pattern que useTokenSocket).

  return { woundVersions }
}
