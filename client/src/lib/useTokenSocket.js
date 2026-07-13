import { useEffect } from 'react'
import { useSocket } from './SocketContext'
import { useTokenStore } from '../stores/tokenStore'
import { WS } from '../../../shared/events.js'

export function useTokenSocket() {
  const socket = useSocket()
  const { addToken, removeToken, updateToken } = useTokenStore()

  useEffect(() => {
    if (!socket) return

    const onMoved = ({ tokenId, pos_x, pos_y, pos_z, position_space, updated_at }) =>
      updateToken({ id: tokenId, pos_x, pos_y, pos_z, position_space, updated_at })
    const onCreated = ({ token }) => addToken(token)
    const onDeleted = ({ tokenId }) => removeToken(tokenId)
    const onUpdated = ({ token }) => updateToken(token)
    const onStatus  = ({ tokenId, statuses, statusExpiries }) =>
      updateToken({ id: tokenId, statuses, statusExpiries: statusExpiries ?? {} })

    socket.on(WS.TOKEN_MOVED,          onMoved)
    socket.on(WS.TOKEN_CREATED,        onCreated)
    socket.on(WS.TOKEN_DELETED,        onDeleted)
    socket.on(WS.TOKEN_UPDATED,        onUpdated)
    socket.on(WS.TOKEN_STATUS_UPDATED, onStatus)

    return () => {
      socket.off(WS.TOKEN_MOVED,          onMoved)
      socket.off(WS.TOKEN_CREATED,        onCreated)
      socket.off(WS.TOKEN_DELETED,        onDeleted)
      socket.off(WS.TOKEN_UPDATED,        onUpdated)
      socket.off(WS.TOKEN_STATUS_UPDATED, onStatus)
    }
  }, [socket])
  // Pas de return — aucun état exposé
}
