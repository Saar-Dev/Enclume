import { useCallback, useEffect, useRef, useState } from 'react'
import { useSocket } from './SocketContext.jsx'
import api from './api.js'
import { WS } from '../../../shared/events.js'

// Équipement en main par token (`GET /battlemaps/:id/combat-equipment`), AUTORITÉ UNIQUE partagée
// par CombatGmDeclareWindow.jsx et CombatRosterWindow.jsx (COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE).
// Remplace deux copies locales indépendantes, chacune figée au chargement de la carte (ou, pour
// CombatRosterWindow, figée dès le début du combat) : un instantané qui ne suivait ni une
// permutation résolue, ni une grenade lancée, ni un quick-equip fait depuis l'AUTRE fenêtre.
// Rafraîchi ici sur les mêmes événements INVENTORY_* déjà émis par ces trois actions
// (combatGrabService.js, socketCombatAoe.js, routes/character/char-sheet.js quick-equip) vers la
// room de campagne — aucun nouvel événement créé.
//
// `characterIds` (Set de character_id, PNJ du roster courant) filtre les événements sans rapport
// avec ce combat (ex. un joueur qui achète pendant que cette fenêtre reste ouverte) : passé à chaque
// rendu, lu via une ref pour ne pas ré-abonner le socket à chaque changement de roster (patron
// `tokensRef` déjà utilisé dans CombatGmDeclareWindow.jsx).
export function useCombatEquipmentSnapshot(battlemapId, characterIds) {
  const socket = useSocket()
  const [equipment, setEquipment] = useState({})

  const characterIdsRef = useRef(characterIds)
  useEffect(() => { characterIdsRef.current = characterIds }, [characterIds])

  const fetchEquipment = useCallback(() => {
    if (!battlemapId) return
    api.get(`/battlemaps/${battlemapId}/combat-equipment`)
      .then(r => setEquipment(r.data.equipment ?? {}))
      .catch(() => {})
  }, [battlemapId])

  useEffect(() => { fetchEquipment() }, [fetchEquipment])

  useEffect(() => {
    if (!socket) return

    const bump = (payload) => {
      const ids = characterIdsRef.current
      if (ids && !ids.has(payload.characterId)) return
      fetchEquipment()
    }

    socket.on(WS.INVENTORY_ADDED,   bump)
    socket.on(WS.INVENTORY_UPDATED, bump)
    socket.on(WS.INVENTORY_REMOVED, bump)

    return () => {
      socket.off(WS.INVENTORY_ADDED,   bump)
      socket.off(WS.INVENTORY_UPDATED, bump)
      socket.off(WS.INVENTORY_REMOVED, bump)
    }
  }, [socket, fetchEquipment])

  return equipment
}
