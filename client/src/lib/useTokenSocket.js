import { useTokenStore } from '../stores/tokenStore'
import { WS } from '../../../shared/events.js'

export function useTokenSocket() {
  const { addToken, removeToken, updateToken } = useTokenStore()

  function listen(s) {
    s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) =>
      updateToken({ id: tokenId, pos_x, pos_y, pos_z, updated_at }))
    s.on(WS.TOKEN_CREATED, ({ token }) => addToken(token))
    s.on(WS.TOKEN_DELETED, ({ tokenId }) => removeToken(tokenId))
    s.on(WS.TOKEN_UPDATED, ({ token }) => updateToken(token))
    s.on(WS.TOKEN_STATUS_UPDATED, ({ tokenId, statuses, statusExpiries }) =>
      updateToken({ id: tokenId, statuses, statusExpiries: statusExpiries ?? {} }))
  }

  return { listen }
}
