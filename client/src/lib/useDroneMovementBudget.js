import { useState, useEffect } from 'react'
import api from './api.js'

// Allures de déplacement d'un drone en combat. Un drone n'a qu'UNE allure : sa Vitesse
// (`drone_sheet.vitesse`, en m/Tour), répliquée sur les 4 paliers `{ lente, moyenne, rapide, max }`
// par le serveur (`getDroneMovementBudget`, `movementBudgetService.js` — décision Saar 2026-08-28).
//
// Le calcul vit UNIQUEMENT côté serveur (CLAUDE.md §7) : ce hook expose son résultat, jamais un
// `DEFAULT_PNJ_ALLURES` en dur ni un `calcAllures()` local (les deux étaient utilisés à tort pour un
// drone — allures fausses côté MJ, `calcAllures(NaN)` côté PJ). Si la Vitesse n'est pas renseignée,
// `GET /char-sheet/:id/drone/movement` répond 400 + message FR affichable, exposé via `error` —
// même patron que `CombatExoActionWindow`/`/exo/movement`, en évitant le reset d'état synchrone dans
// l'effet (le cas inactif est dérivé au rendu, pas écrit dans un state).
//
// Partagé par `CombatActionWindow` (drone PJ) et `CombatGmDeclareWindow` (drone MJ).
const EMPTY = { allures: null, error: null }

export function useDroneMovementBudget(charId, enabled = true) {
  const [result, setResult] = useState(EMPTY)
  const active = enabled && !!charId

  useEffect(() => {
    if (!active) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/drone/movement`)
      .then(r => { if (!cancelled) setResult({ allures: r.data.allures, error: null }) })
      .catch(e => {
        if (cancelled) return
        setResult({ allures: null, error: e.response?.data?.error?.message || e.response?.data?.message || e.message })
      })
    return () => { cancelled = true }
  }, [charId, active])

  return active ? result : EMPTY
}
