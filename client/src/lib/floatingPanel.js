import { useCallback, useEffect, useRef, useState } from 'react'

export function clampFloatingPanelPosition({
  left,
  top,
  width,
  height,
  viewportWidth,
  viewportHeight,
}) {
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(48, Number(height) || 48)
  const safeViewportWidth = Math.max(safeWidth + 16, Number(viewportWidth) || safeWidth + 16)
  const safeViewportHeight = Math.max(64, Number(viewportHeight) || safeHeight + 16)
  return {
    left: Math.max(8, Math.min(safeViewportWidth - safeWidth - 8, Number(left) || 8)),
    top: Math.max(8, Math.min(safeViewportHeight - Math.min(safeHeight, 48), Number(top) || 8)),
  }
}

function viewport() {
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }
}

export function useDraggablePanelPosition({ x, y, width, height }) {
  const initialPosition = useCallback(() => clampFloatingPanelPosition({
    left: x,
    top: y,
    width,
    height,
    ...viewport(),
  }), [height, width, x, y])
  const [position, setPosition] = useState(initialPosition)
  const dragRef = useRef(null)

  useEffect(() => {
    const move = event => {
      const drag = dragRef.current
      if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return
      setPosition(clampFloatingPanelPosition({
        left: drag.left + event.clientX - drag.clientX,
        top: drag.top + event.clientY - drag.clientY,
        width,
        height,
        ...viewport(),
      }))
    }
    const stop = event => {
      if (!dragRef.current || (event.pointerId != null && dragRef.current.pointerId !== event.pointerId)) return
      dragRef.current = null
    }
    const resize = () => setPosition(current => clampFloatingPanelPosition({
      ...current,
      width,
      height,
      ...viewport(),
    }))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('resize', resize)
    }
  }, [height, width])

  const beginDrag = useCallback(event => {
    if (event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left: position.left,
      top: position.top,
    }
    event.currentTarget?.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }, [position.left, position.top])

  return { position, beginDrag }
}
