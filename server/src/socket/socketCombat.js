import { registerStateHandlers }        from './socketCombatState.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { registerResolutionHandlers }   from './socketCombatResolution.js'

export function registerCombatHandlers(io, socket, context, pendingMaps) {
  registerStateHandlers(io, socket, context, pendingMaps)
  registerAnnouncementHandlers(io, socket, context, pendingMaps)
  registerResolutionHandlers(io, socket, context, pendingMaps)
}
