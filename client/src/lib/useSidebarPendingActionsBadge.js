import { useEffect, useRef, useState } from 'react'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 4d) — comportement inchangé.
// Reste appelé depuis Sidebar.jsx : le badge est affiché sur le bouton d'onglet "Chat", hors
// du contenu d'onglet (visible même quand un autre onglet est actif).
export function useSidebarPendingActionsBadge(messages, isGm) {
  const [pendingActionCount, setPendingActionCount] = useState(0)
  const prevEntityActionCountRef = useRef(0)
  const prevSellRequestCountRef    = useRef(0)
  const prevExchangeOfferCountRef  = useRef(0)

  useEffect(() => {
    if (!isGm) return
    const entityCount = messages.filter(m => m.type === 'entity_action').length
    const sellCount     = messages.filter(m => m.type === 'sell_request').length
    const exchangeCount = messages.filter(m => m.type === 'exchange_offer').length
    let delta = 0
    if (entityCount   > prevEntityActionCountRef.current)  delta += entityCount   - prevEntityActionCountRef.current
    if (sellCount     > prevSellRequestCountRef.current)   delta += sellCount     - prevSellRequestCountRef.current
    if (exchangeCount > prevExchangeOfferCountRef.current) delta += exchangeCount - prevExchangeOfferCountRef.current
    if (delta > 0) setPendingActionCount(prev => prev + delta)
    prevEntityActionCountRef.current   = entityCount
    prevSellRequestCountRef.current    = sellCount
    prevExchangeOfferCountRef.current  = exchangeCount
  }, [messages, isGm])

  return { pendingActionCount, setPendingActionCount }
}
