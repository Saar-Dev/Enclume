import { useCallback, useEffect, useRef, useState } from 'react'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 4d) — comportement inchangé.
// Reste appelé depuis Sidebar.jsx : le popover est rendu au niveau racine, hors du contenu
// d'onglet (visible quel que soit l'onglet actif tant qu'il n'est pas fermé).
export function useDiceBreakdownPopover() {
  const [breakdownPopover, setBreakdownPopover] = useState(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!breakdownPopover) return
    const onMouse = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setBreakdownPopover(null) }
    const onKey   = (e) => { if (e.key === 'Escape') setBreakdownPopover(null) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [breakdownPopover])

  const handleOpenBreakdown = useCallback((e, msg) => {
    e.stopPropagation()
    if (breakdownPopover?.msgId === msg.id) { setBreakdownPopover(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setBreakdownPopover({ msgId: msg.id, breakdown: msg.breakdown, rect })
  }, [breakdownPopover])

  return { breakdownPopover, popoverRef, handleOpenBreakdown }
}
