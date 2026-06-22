import { useState, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCharacterStore } from '../stores/characterStore'
import { useSocket } from './SocketContext'

export function useCharacterSocket() {
  const socket = useSocket()
  const { updateCharacter } = useCharacterStore()
  const [woundVersions, setWoundVersions] = useState({})

  useEffect(() => {
    if (!socket) return

    const onWoundAdded = ({ characterId, worst_wound_severity }) => {
      setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
      updateCharacter({ id: characterId, worst_wound_severity })
    }
    const onWoundUpdated = ({ characterId, worst_wound_severity }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
      updateCharacter({ id: characterId, worst_wound_severity })
    }
    const onWoundRemoved = ({ characterId, worst_wound_severity }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
      updateCharacter({ id: characterId, worst_wound_severity })
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
  // [socket] uniquement — updateCharacter (Zustand action) et setWoundVersions (setter useState)
  // sont des références stables, non listées dans les deps (même pattern que useTokenSocket).

  return { woundVersions }
}
