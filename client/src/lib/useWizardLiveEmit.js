import { useRef, useCallback, useEffect } from 'react'
import { useSocket, useSocketReady } from './SocketContext.jsx'
import { WS } from '../../../shared/events.js'

const DEBOUNCE_MS = 250

// Diffusion live du brouillon en cours de saisie (docs/PLAN_WIZARDCOLLAB.md Lot A4, §2.5/§5bis) —
// jamais persisté, jamais validé métier, purement cosmétique pour les autres clients de la room
// wizard:<sheetId> (distinct de reconcile/WIZARD_STATE_SYNC, seule autorité durable). Debounce
// centralisé ici (pas dans chaque composant d'étape) : un seul endroit à ajuster, `onLiveChange` des
// composants reste un simple callback sans logique de timer.
//
// ready (useSocketReady, pas juste `!!socket`) : même garde que useWizardLock.js/WizardLockSync.jsx —
// évite de rejouer le bug de course déjà corrigé en Lot A2 (émission avant que le serveur ait posé
// ses listeners).
export function useWizardLiveEmit(sheetId) {
  const socket = useSocket()
  const ready = useSocketReady()
  const timeoutRef = useRef(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const emitLive = useCallback((step, data) => {
    if (!socket || !ready || !sheetId) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      socket.emit(WS.WIZARD_LIVE_UPDATE, { sheetId, step, data })
    }, DEBOUNCE_MS)
  }, [socket, ready, sheetId])

  return { emitLive }
}
