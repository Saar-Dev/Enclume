import { useEffect } from 'react'
import { useSocket, useSocketReady } from '../../lib/SocketContext.jsx'
import { useCreationStore } from '../../stores/creationStore'
import { useWizardLiveEmit } from '../../lib/useWizardLiveEmit'
import { WS } from '../../../../shared/events.js'

// Rejoint la room wizard:<sheetId> et synchronise verrous + contenu de fiche en direct
// (docs/PLAN_WIZARDCOLLAB.md Lots A2/A3/A4). Composant sans rendu — doit être monté à l'intérieur de
// <SocketProvider> (WizardCreation.jsx ne peut pas appeler useSocket() lui-même, il rend le
// Provider). Hygiène des listeners (§0 6e passe du plan, react.md) : fonctions stables, retirées au
// démontage ; filtre défensif sur sheetId au cas où le nettoyage de room côté serveur aurait un trou.
//
// `ready` (useSocketReady, pas juste `!!socket`) est obligatoire ici : useSocket() rend un objet
// non-null dès le montage du Provider, bien avant que la connexion réseau existe — émettre
// WIZARD_JOIN à ce moment court-circuite SESSION_JOIN lui-même (jamais reçu côté serveur à temps),
// verrous MJ inertes en silence. Bug réel trouvé en test navigateur (docs/PLAN_WIZARDCOLLAB.md).
//
// `emitLiveRef` (Lot A4, §2.5/§6.4bis) : WizardCreation.jsx ne peut pas non plus appeler
// useWizardLiveEmit() lui-même (même contrainte que ci-dessus — il rend le Provider, n'en est pas
// descendant). Ce composant EST le descendant correctement positionné : il dépose la fonction
// emitLive dans la ref fournie par l'ancêtre, seul moyen de la lui faire remonter sans dupliquer le
// câblage socket dans chacun des 5 composants d'étape.
export default function WizardLockSync({ sheetId, emitLiveRef }) {
  const socket = useSocket()
  const ready = useSocketReady()
  const setLockedOptions = useCreationStore(s => s.setLockedOptions)
  const applyStateSync = useCreationStore(s => s.applyStateSync)
  const applyLiveDraft = useCreationStore(s => s.applyLiveDraft)
  const { emitLive } = useWizardLiveEmit(sheetId)

  useEffect(() => {
    emitLiveRef.current = emitLive
    return () => { emitLiveRef.current = () => {} }
  }, [emitLiveRef, emitLive])

  useEffect(() => {
    if (!socket || !ready || !sheetId) return

    const handleLocksSync = (payload) => {
      if (payload.sheetId !== sheetId) return
      setLockedOptions(payload.locks)
    }
    // Contenu de fiche réconcilié par n'importe quel client de la même room (soi-même inclus — écho
    // du serveur canonique après validation/normalisation, jamais un problème puisqu'on vient de
    // soumettre exactement ça). Sans ceci, un MJ déjà ouvert sur la fiche ne voit jamais les
    // avancées du joueur sans recharger la page (bug réel remonté par Saar).
    const handleStateSync = (payload) => {
      if (payload.sheetId !== sheetId) return
      applyStateSync(payload)
    }
    // Brouillon en cours de saisie, éphémère (docs/PLAN_WIZARDCOLLAB.md Lot A4, §2.5/§5bis) — jamais
    // reçu en écho par soi-même (serveur diffuse via socket.to, émetteur exclu), donc pas de risque
    // de rafraîchir sa propre frappe en cours.
    const handleLiveUpdate = (payload) => {
      if (payload.sheetId !== sheetId) return
      applyLiveDraft(payload.step, payload.data)
    }
    const handleError = (payload) => {
      console.warn('[Wizard] verrou — erreur serveur:', payload.i18nKey)
    }

    socket.on(WS.WIZARD_LOCKS_SYNC, handleLocksSync)
    socket.on(WS.WIZARD_STATE_SYNC, handleStateSync)
    socket.on(WS.WIZARD_LIVE_UPDATE, handleLiveUpdate)
    socket.on(WS.WIZARD_ERROR, handleError)
    socket.emit(WS.WIZARD_JOIN, { sheetId })

    return () => {
      socket.off(WS.WIZARD_LOCKS_SYNC, handleLocksSync)
      socket.off(WS.WIZARD_STATE_SYNC, handleStateSync)
      socket.off(WS.WIZARD_LIVE_UPDATE, handleLiveUpdate)
      socket.off(WS.WIZARD_ERROR, handleError)
    }
  }, [socket, ready, sheetId, setLockedOptions, applyStateSync, applyLiveDraft])

  return null
}
