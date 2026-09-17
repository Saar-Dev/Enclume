import { useCallback, useRef } from 'react'

const DEFAULT_WINDOW_MS = 350

// useDoubleClickTracker — détecte un double-clic sur une même cible (par id), indépendamment de
// l'événement natif `dblclick`. Nécessaire ici : le clic sur un token est géré à la main via
// pointerdown/pointermove/pointerup sur le canvas WebGL (raycasting manuel dans Canvas3D.jsx), pas
// via les props JSX onClick de React Three Fiber — `dblclick` du DOM ne s'y déclenche pas de façon
// fiable. Un second clic sur un id différent repart à zéro (pas de double-clic croisé entre deux
// tokens).
export function useDoubleClickTracker(windowMs = DEFAULT_WINDOW_MS) {
  const lastRef = useRef({ id: null, at: 0 })

  return useCallback((id) => {
    const now = Date.now()
    const last = lastRef.current
    const isDouble = last.id === id && (now - last.at) <= windowMs
    lastRef.current = isDouble ? { id: null, at: 0 } : { id, at: now }
    return isDouble
  }, [windowMs])
}
