import { useState, useRef, useEffect } from 'react'

// useDraggable — position draggable avec persistance localStorage + clamp écran
// storageKey : clé unique par fenêtre
// defaultPos : { left, top } calculé au call site (window.innerWidth/Height disponibles)
// panelW     : largeur connue de la fenêtre (pour clamp horizontal)
export function useDraggable(storageKey, defaultPos, panelW) {
  const clamp = (p) => ({
    left: Math.max(8, Math.min(window.innerWidth  - panelW - 8, p.left)),
    top:  Math.max(8, Math.min(window.innerHeight - 40,          p.top)),
  })

  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      if (saved?.left != null) return clamp(saved)
    } catch {}
    return clamp(defaultPos)
  })

  const dragRef = useRef(null)
  const posRef  = useRef(pos)

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, ...posRef.current }
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return
      const p = clamp({
        left: dragRef.current.left + (e.clientX - dragRef.current.startX),
        top:  dragRef.current.top  + (e.clientY - dragRef.current.startY),
      })
      posRef.current = p
      setPos(p)
    }
    const onUp = () => {
      if (!dragRef.current) return
      localStorage.setItem(storageKey, JSON.stringify(posRef.current))
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, []) // storageKey et panelW sont stables par mount

  return { pos, onHeaderMouseDown }
}
