import { useEffect, useRef } from 'react'

const TRACKPAD_STEP_THRESHOLD = 32
const ROTATION_COOLDOWN_MS = 90

function wheelDeltaPixels(event) {
  const delta = Number(event?.deltaY) || 0
  if (event?.deltaMode === 1) return delta * 16
  if (event?.deltaMode === 2) return delta * 800
  return delta
}

/**
 * Réserve la molette à l'orientation tant qu'un fantôme rotatif est présent.
 * Les crans de souris tournent une fois ; les petits deltas d'un pavé tactile
 * sont accumulés afin de ne pas faire défiler plusieurs quarts de tour d'un coup.
 */
export function usePlacementWheelRotation({ element, enabled, onRotate }) {
  const onRotateRef = useRef(onRotate)
  const accumulatedDeltaRef = useRef(0)
  const directionRef = useRef(0)
  const lastRotationAtRef = useRef(-Infinity)

  useEffect(() => {
    onRotateRef.current = onRotate
  }, [onRotate])

  useEffect(() => {
    if (!element || !enabled) {
      accumulatedDeltaRef.current = 0
      directionRef.current = 0
      return undefined
    }

    const handleWheel = event => {
      const delta = wheelDeltaPixels(event)
      if (!delta) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()

      const direction = Math.sign(delta)
      if (directionRef.current !== direction) accumulatedDeltaRef.current = 0
      directionRef.current = direction

      const isMouseWheelNotch = event.deltaMode !== 0 || Math.abs(delta) >= 50
      accumulatedDeltaRef.current += isMouseWheelNotch
        ? direction * TRACKPAD_STEP_THRESHOLD
        : delta
      if (Math.abs(accumulatedDeltaRef.current) < TRACKPAD_STEP_THRESHOLD) return

      accumulatedDeltaRef.current = 0
      const now = performance.now()
      if (now - lastRotationAtRef.current < ROTATION_COOLDOWN_MS) return
      lastRotationAtRef.current = now
      onRotateRef.current?.(direction)
    }

    element.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel, { capture: true })
      accumulatedDeltaRef.current = 0
      directionRef.current = 0
    }
  }, [element, enabled])
}
