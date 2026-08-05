import { useEffect, useState } from 'react'
import { useSocket } from './SocketContext.jsx'
import { WS } from '../../../shared/events.js'

// ModingWindow.jsx — rafraîchissement live indépendant du store (PLAN_INVENTORY_UX.md §3.2).
// ModingWindow affiche une forme jointe armes+mods (/moding/state), différente des items bruts
// d'inventoryByCharId — il reste volontairement hors du store partagé, sur le modèle de
// useWizardInventorySync.js (même filtre characterId obligatoire : la room de campagne n'est pas
// filtrée par personnage côté client, ce socket reçoit aussi les events d'autres personnages).
export function useModingRefreshSync(characterId) {
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
    socket.on(WS.MOD_INSTALLED, bump)

    return () => {
      socket.off(WS.INVENTORY_ADDED, bump)
      socket.off(WS.INVENTORY_UPDATED, bump)
      socket.off(WS.INVENTORY_REMOVED, bump)
      socket.off(WS.MOD_INSTALLED, bump)
    }
  }, [socket, characterId])

  return reloadKey
}
