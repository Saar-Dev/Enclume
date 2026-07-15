import { createContext, useContext, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'

const SocketContext = createContext(null)

export function SocketProvider({ campaignId, children }) {
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const socketEndpoint = import.meta.env.VITE_API_URL || undefined
    const s = io(socketEndpoint, { withCredentials: true })
    s.on('connect', () => {
      s.emit(WS.SESSION_JOIN, { campaignId })
    })
    setSocket(s)
    return () => s.disconnect()
  }, [campaignId])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
