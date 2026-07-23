import { useEffect } from 'react'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useCreationStore } from '../../stores/creationStore'
import { WS } from '../../../../shared/events.js'

// Rejoint la room wizard:<sheetId> et synchronise les verrous MJ (docs/PLAN_WIZARDCOLLAB.md Lot A2).
// Composant sans rendu — doit être monté à l'intérieur de <SocketProvider> (WizardCreation.jsx ne
// peut pas appeler useSocket() lui-même, il rend le Provider). Hygiène des listeners (§0 6e passe du
// plan, react.md) : fonctions stables, retirées au démontage ; filtre défensif sur sheetId au cas où
// le nettoyage de room côté serveur aurait un trou.
export default function WizardLockSync({ sheetId }) {
  const socket = useSocket()
  const setLockedOptions = useCreationStore(s => s.setLockedOptions)

  useEffect(() => {
    if (!socket || !sheetId) return

    const handleLocksSync = (payload) => {
      if (payload.sheetId !== sheetId) return
      setLockedOptions(payload.locks)
    }
    const handleError = (payload) => {
      console.warn('[Wizard] verrou — erreur serveur:', payload.i18nKey)
    }

    socket.on(WS.WIZARD_LOCKS_SYNC, handleLocksSync)
    socket.on(WS.WIZARD_ERROR, handleError)
    socket.emit(WS.WIZARD_JOIN, { sheetId })

    return () => {
      socket.off(WS.WIZARD_LOCKS_SYNC, handleLocksSync)
      socket.off(WS.WIZARD_ERROR, handleError)
    }
  }, [socket, sheetId, setLockedOptions])

  return null
}
