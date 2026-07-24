import { useCreationStore } from '../stores/creationStore'
import { useSocket, useSocketReady } from './SocketContext.jsx'
import { WS } from '../../../shared/events.js'

// Câblage verrous MJ pour un composant d'étape du Wizard (docs/PLAN_WIZARDCOLLAB.md Lot A2).
// `step` est fixe par composant (1-5) ; `optionKey` est calculé par l'appelant via
// shared/wizardOptionKeys.js pour l'option concernée.
//
// Icône cadenas dédiée pour basculer un verrou (décision Saar, uniforme sur les 5 étapes) — jamais
// une réinterprétation du clic de sélection normal, qui garde toujours son sens habituel.
export function useWizardLock(step) {
  const socket = useSocket()
  const ready = useSocketReady()
  const sheetId = useCreationStore(s => s.sheetId)
  const isGmView = useCreationStore(s => s.isGmView)
  const guideModeActive = useCreationStore(s => s.guideModeActive)
  const lockedOptions = useCreationStore(s => s.lockedOptions)

  const isLocked = (optionKey) => optionKey != null && lockedOptions.has(optionKey)

  // Grisé + non cliquable pour le joueur uniquement — le MJ n'est jamais bloqué par ses propres
  // verrous (docs/PLAN_WIZARDCOLLAB.md §4.5) ; il les voit via l'icône cadenas active, pas ce flag.
  const isLockedForPlayer = (optionKey) => !isGmView && isLocked(optionKey)

  // ready (useSocketReady) : garde défensive, même motif que WizardLockSync.jsx — un clic manuel
  // arrive presque toujours bien après la poignée de main SESSION_JOIN, mais rien ne l'garantit.
  const toggleLock = (optionKey) => {
    if (!socket || !ready || !sheetId || optionKey == null) return
    socket.emit(WS.WIZARD_LOCK_UPDATE, { sheetId, step, optionKey, locked: !isLocked(optionKey) })
  }

  return { isLocked, isLockedForPlayer, toggleLock, showLockToggle: isGmView && guideModeActive }
}
