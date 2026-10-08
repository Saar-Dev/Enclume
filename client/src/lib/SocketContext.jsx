import { createContext, useContext, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'

const SocketContext = createContext(null)
// useSocket() garde son contrat exact (retourne juste l'instance socket, tous les consommateurs
// existants la déstructurent ainsi) — "prêt" vit dans un contexte séparé, opt-in, sans casser
// personne. "Prêt" = SESSION_JOINED reçu, donc tous les registerXHandlers serveur déjà posés
// (socket/index.js) — voir useSocketReady() ci-dessous, motif exact dans WizardLockSync.jsx.
const SocketReadyContext = createContext(false)

// SOCKET-STRICTMODE-RECONNECT-HANG (ticket 9f6c2a6e, suite — 2026-10-07) — un seul Socket/Manager
// pour toute la durée de l'onglet, créé hors du composant : patron officiel
// (socket.io/how-to/use-with-react). StrictMode (toujours actif, main.jsx) monte cet effet deux
// fois de suite (connect → disconnect → connect, mêmes deps) ; avec un `io(...)` recréé à CHAQUE
// montage, la 2ᵉ connexion arrivait parfois sur une session engine.io déjà fermée côté serveur —
// confirmé par des 400 Bad Request / upgrade WebSocket refusé dans le journal réseau (Firefox), le
// temps que la reconnexion automatique se débloque étant imprévisible. `autoConnect: false` +
// `.connect()`/`.disconnect()` sur le MÊME objet : la doc officielle garantit `connect()`
// idempotent, et le moteur engine.io (vérifié dans son code source, socket.io-client 4.8.3) gère
// proprement un close() appelé en pleine ouverture puis un open() qui suit — un seul état cohérent
// au lieu de deux Manager concurrents sur le même sid. Un changement RÉEL de campagne/contexte
// continue de déclencher disconnect+reconnect (comportement inchangé), simplement sur cet unique
// objet. N'A PAS résolu le trou de chargement de 20-40s rapporté par ailleurs (ticket 9f6c2a6e) —
// celui-ci ne reproduit que sur le tout premier chargement d'un navigateur juste démarré (jamais
// sur une navigation interne ultérieure), ce qui pointe vers une cause externe au code (réseau /
// sécurité Windows), encore à vérifier (voir ticket pour la suite).
const socketEndpoint = import.meta.env.VITE_API_URL || undefined
const socket = io(socketEndpoint, { withCredentials: true, autoConnect: false })

export function SocketProvider({ campaignId, context = 'session', children }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handleConnect = () => {
      // `context` ('session' | 'wizard') — attribue le temps de présence côté serveur (Lot C).
      socket.emit(WS.SESSION_JOIN, { campaignId, context })
    }
    // SESSION_JOINED est la seule confirmation que le serveur a fini son traitement (et posé ses
    // propres listeners, registerWizardHandlers inclus) : ready ne passe à true qu'à ce moment.
    const handleSessionJoined = () => {
      setReady(true)
    }
    socket.on('connect', handleConnect)
    socket.on(WS.SESSION_JOINED, handleSessionJoined)
    socket.connect()
    return () => {
      socket.off('connect', handleConnect)
      socket.off(WS.SESSION_JOINED, handleSessionJoined)
      socket.disconnect()
      setReady(false)
    }
  }, [campaignId, context])

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
