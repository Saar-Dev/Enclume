import { createContext, useContext, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'

const SocketContext = createContext(null)
// useSocket() garde son contrat exact (retourne juste l'instance socket, tous les consommateurs
// existants la déstructurent ainsi) — "prêt" vit dans un contexte séparé, opt-in, sans casser
// personne. "Prêt" = SESSION_JOINED reçu, donc tous les registerXHandlers serveur déjà posés
// (socket/index.js) — voir useSocketReady() ci-dessous, motif exact dans WizardLockSync.jsx.
const SocketReadyContext = createContext(false)

export function SocketProvider({ campaignId, children }) {
  const [socket, setSocket] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const socketEndpoint = import.meta.env.VITE_API_URL || undefined
    const s = io(socketEndpoint, { withCredentials: true })
    s.on('connect', () => {
      s.emit(WS.SESSION_JOIN, { campaignId })
    })
    // setSocket(s) ci-dessous rend useSocket() non-null immédiatement (bien avant 'connect',
    // network réel) — un composant qui émettrait un événement de domaine dès que useSocket() existe
    // court-circuiterait SESSION_JOIN lui-même, pas seulement les handlers posés après (bug réel
    // trouvé en test navigateur, docs/PLAN_WIZARDCOLLAB.md — verrous MJ inertes). SESSION_JOINED est
    // la seule confirmation que le serveur a fini son traitement (et posé ses propres listeners,
    // registerWizardHandlers inclus) : ready ne passe à true qu'à ce moment.
    s.on(WS.SESSION_JOINED, () => setReady(true))
    setSocket(s)
    return () => { s.disconnect(); setReady(false) }
  }, [campaignId])

  return (
    <SocketContext.Provider value={socket}>
      <SocketReadyContext.Provider value={ready}>
        {children}
      </SocketReadyContext.Provider>
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}

// À vérifier avant d'émettre un événement de domaine dès le montage d'un composant (pattern
// WizardLockSync.jsx) — pas nécessaire pour un événement déclenché par une interaction utilisateur
// explicite survenant naturellement après coup (clic, plusieurs secondes après le montage).
export function useSocketReady() {
  return useContext(SocketReadyContext)
}
