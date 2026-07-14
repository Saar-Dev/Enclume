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
  const maximumTop = Math.max(8, safeViewportHeight - safeHeight - 8)
  return {
    left: Math.max(8, Math.min(safeViewportWidth - safeWidth - 8, Number(left) || 8)),
    top: Math.max(8, Math.min(maximumTop, Number(top) || 8)),
  }
}

function viewport() {
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }
}

export function floatingPanelPositionBesideAnchor({
  x,
  y,
  width,
  height,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
  gap = 22,
}) {
  const anchorX = Number(x) || viewportWidth / 2
  const anchorY = Number(y) || viewportHeight / 2
  const right = anchorX + gap
  const left = anchorX - width - gap
  const preferredLeft = right + width + 8 <= viewportWidth ? right : left
  return clampFloatingPanelPosition({
    left: preferredLeft,
    top: anchorY - Math.min(height, viewportHeight - 16) / 2,
    width,
    height,
    viewportWidth,
    viewportHeight,
  })
}

export function useDraggablePanelPosition({ x, y, width, height, placement = 'beside', panelRef: suppliedPanelRef = null }) {
  const internalPanelRef = useRef(null)
  const panelRef = suppliedPanelRef || internalPanelRef
  const initialPosition = useCallback(() => clampFloatingPanelPosition({
    ...(placement === 'beside'
      ? floatingPanelPositionBesideAnchor({ x, y, width, height, ...viewport() })
      : { left: x, top: y }),
    width,
    height,
    ...viewport(),
  }), [height, placement, width, x, y])
  const [position, setPosition] = useState(initialPosition)
  const dragRef = useRef(null)
  const measuredRef = useRef(false)
  const measuredSizeRef = useRef({ width, height })

  useEffect(() => {
    const element = panelRef.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const measuredWidth = Math.max(1, Math.ceil(element.getBoundingClientRect().width || rect.width || width))
      const measuredHeight = Math.max(48, Math.ceil(element.getBoundingClientRect().height || rect.height || height))
      measuredSizeRef.current = { width: measuredWidth, height: measuredHeight }
      if (!measuredRef.current) {
        measuredRef.current = true
        setPosition(placement === 'beside'
          ? floatingPanelPositionBesideAnchor({ x, y, width: measuredWidth, height: measuredHeight, ...viewport() })
          : clampFloatingPanelPosition({ left: x, top: y, width: measuredWidth, height: measuredHeight, ...viewport() }))
        return
      }
      setPosition(current => clampFloatingPanelPosition({
        ...current,
        width: measuredWidth,
        height: measuredHeight,
        ...viewport(),
      }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [height, panelRef, placement, width, x, y])

  useEffect(() => {
    const move = event => {
      const drag = dragRef.current
      if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return
      setPosition(clampFloatingPanelPosition({
        left: drag.left + event.clientX - drag.clientX,
        top: drag.top + event.clientY - drag.clientY,
        width: measuredSizeRef.current.width,
        height: measuredSizeRef.current.height,
        ...viewport(),
      }))
    }
    const stop = event => {
      if (!dragRef.current || (event.pointerId != null && dragRef.current.pointerId !== event.pointerId)) return
      dragRef.current = null
    }
    const resize = () => setPosition(current => clampFloatingPanelPosition({
      ...current,
      width: measuredSizeRef.current.width,
      height: measuredSizeRef.current.height,
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

  return { position, beginDrag, panelRef }
}
