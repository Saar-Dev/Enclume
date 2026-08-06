import { useCallback, useEffect, useMemo } from 'react'
import { WS } from '../../../shared/events.js'
import { useWorldRuntimeStore } from '../stores/worldRuntimeStore.js'

// Extrait d'Editor3D.jsx/Canvas3D.jsx (PLAN_WORLD_RUNTIME_EFFECTS_STORE.md, Lot A) — comportement
// inchangé, filtrage WORLD_RUNTIME_UPDATED repris tel quel depuis Editor3D.jsx (déjà correct : ignore
// les ticks d'ascenseur pour les effets, ignore les événements non-ascenseur pour les ascenseurs).
//
// Appelé UNE SEULE FOIS par session — depuis Editor3D.jsx OU Canvas3D.jsx selon le mode (mutuellement
// exclusifs, jamais montés ensemble sur une carte 3D). Sidebar.jsx ne l'appelle pas : son panneau de
// gestion des effets n'est visible que pendant qu'Editor3D.jsx est monté et synchronise déjà le store.
export function useWorldRuntimeSync(battlemapId, socket) {
  const worldEffects = useWorldRuntimeStore(s => s.worldEffects)
  const runtimeElevatorStates = useWorldRuntimeStore(s => s.runtimeElevatorStates)
  const fetchWorldEffects = useWorldRuntimeStore(s => s.fetchWorldEffects)
  const fetchRuntimeElevators = useWorldRuntimeStore(s => s.fetchRuntimeElevators)

  const refreshWorldEffects = useCallback(() => fetchWorldEffects(battlemapId), [battlemapId, fetchWorldEffects])
  const refreshRuntimeElevators = useCallback(() => fetchRuntimeElevators(battlemapId), [battlemapId, fetchRuntimeElevators])

  useEffect(() => { refreshWorldEffects() }, [refreshWorldEffects])
  useEffect(() => { refreshRuntimeElevators() }, [refreshRuntimeElevators])

  const elevatorsAreTransitioning = useMemo(
    () => Object.values(runtimeElevatorStates).some(state => ['closing', 'moving', 'opening'].includes(state?.phase)),
    [runtimeElevatorStates],
  )

  useEffect(() => {
    if (!elevatorsAreTransitioning) return undefined
    const timer = window.setInterval(refreshRuntimeElevators, 300)
    return () => window.clearInterval(timer)
  }, [elevatorsAreTransitioning, refreshRuntimeElevators])

  useEffect(() => {
    if (!socket || !battlemapId) return undefined
    const handleRuntimeUpdate = event => {
      if (String(event?.battlemapId) !== String(battlemapId)) return
      if (event?.kind !== 'elevator-clock') refreshRuntimeElevators()
      if (!String(event?.kind || '').startsWith('elevator-')) refreshWorldEffects()
    }
    socket.on(WS.WORLD_RUNTIME_UPDATED, handleRuntimeUpdate)
    return () => socket.off(WS.WORLD_RUNTIME_UPDATED, handleRuntimeUpdate)
  }, [socket, battlemapId, refreshWorldEffects, refreshRuntimeElevators])

  return { worldEffects, runtimeElevatorStates, refreshWorldEffects, refreshRuntimeElevators }
}
