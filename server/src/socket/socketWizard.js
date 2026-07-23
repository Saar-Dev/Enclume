// socketWizard.js — Wizard collaboratif GM/Joueur (docs/PLAN_WIZARDCOLLAB.md Lot A1).
//
// Room dédiée par brouillon (wizard:<sheetId>), jamais la room de campagne — un joueur connecté
// ne doit jamais voir qu'un autre est en train de créer un personnage, ni le détail de ses
// verrous (§0 2e passe du plan). resolveSheetAccess (creationService.js) est la même fonction que
// le middleware REST router.param('sheetId') — pas de réimplémentation de la chaîne d'accès.
//
// WIZARD_ERROR ne porte jamais de texte FR figé (`docs/SYSTEME/LOCALISATION.md` §4, `.claude/rules/
// i18n.md`) : uniquement `{ system: true, i18nKey }`, résolu côté client via t() (namespace
// `creation`, clés `wizard.errors.*`).

import { WS } from '../../../shared/events.js'
import { resolveSheetAccess, getWizardLocks, toggleWizardLock } from '../services/creationService.js'

function emitWizardError(socket, i18nKey) {
  socket.emit(WS.WIZARD_ERROR, { system: true, i18nKey })
}

export function registerWizardHandlers(io, socket, context) {
  const { user } = context

  // Un seul brouillon actif par connexion (§0 6e passe) : sans ça, un MJ qui ouvre le brouillon B
  // sans fermer le brouillon A resterait membre des deux rooms et recevrait des mises à jour
  // croisées — le socket reste connecté à travers toute la SPA (pas de reconnexion entre pages).
  function leavePreviousWizardRooms() {
    for (const room of [...socket.rooms]) {
      if (room.startsWith('wizard:')) socket.leave(room)
    }
  }

  socket.on(WS.WIZARD_JOIN, async ({ sheetId }) => {
    try {
      await resolveSheetAccess(sheetId, user.id)
      leavePreviousWizardRooms()
      socket.join(`wizard:${sheetId}`)
      const locks = await getWizardLocks(sheetId)
      socket.emit(WS.WIZARD_LOCKS_SYNC, { sheetId, locks })
    } catch {
      emitWizardError(socket, 'wizard.errors.accessDenied')
    }
  })

  socket.on(WS.WIZARD_LOCK_UPDATE, async ({ sheetId, step, optionKey, locked }) => {
    try {
      const { isGm } = await resolveSheetAccess(sheetId, user.id)
      if (!isGm) {
        emitWizardError(socket, 'wizard.errors.gmOnly')
        return
      }
      if (!Number.isInteger(step) || step < 1 || step > 5 || !optionKey || typeof optionKey !== 'string') {
        emitWizardError(socket, 'wizard.errors.invalidLock')
        return
      }
      const locks = await toggleWizardLock(sheetId, step, optionKey, !!locked)
      io.to(`wizard:${sheetId}`).emit(WS.WIZARD_LOCKS_SYNC, { sheetId, locks })
    } catch {
      emitWizardError(socket, 'wizard.errors.accessDenied')
    }
  })
}
