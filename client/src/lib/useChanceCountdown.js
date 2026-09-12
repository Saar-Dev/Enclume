import { useState, useEffect } from 'react'

// useChanceCountdown — secondes restantes avant la résolution automatique d'un choix Chance
// (PLAN_CHANCE.md L3e-1/L3e-4, timeout serveur — retour Saar : le délai semblait arbitraire sans
// affichage). Utilisé par CatastropheChoiceQueue.jsx (rolledAt + timeoutMs, tous deux transmis par
// le serveur). Retourne `null` tant qu'aucun choix n'est en attente (pas de tick inutile).
export function useChanceCountdown(rolledAt, timeoutMs) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!rolledAt || !timeoutMs) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [rolledAt, timeoutMs])

  if (!rolledAt || !timeoutMs) return null
  const remainingMs = new Date(rolledAt).getTime() + timeoutMs - now
  return Math.max(0, Math.ceil(remainingMs / 1000))
}
