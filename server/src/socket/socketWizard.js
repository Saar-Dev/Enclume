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
    console.log(`[DBG][Wizard] WIZARD_JOIN reçu — user=${user.id} sheetId=${sheetId} socket=${socket.id}`)
    try {
      await resolveSheetAccess(sheetId, user.id)
      leavePreviousWizardRooms()
      socket.join(`wizard:${sheetId}`)
      const locks = await getWizardLocks(sheetId)
      console.log(`[DBG][Wizard] room wizard:${sheetId} rejointe par ${user.id}, ${locks.length} verrou(s), rooms socket=${[...socket.rooms]}`)
      socket.emit(WS.WIZARD_LOCKS_SYNC, { sheetId, locks })
    } catch (err) {
      console.error(`[DBG][Wizard] WIZARD_JOIN échoué — user=${user.id} sheetId=${sheetId} :`, err.message, err.stack)
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
      console.log(`[DBG][Wizard] WIZARD_LOCK_UPDATE appliqué — sheetId=${sheetId} step=${step} optionKey=${optionKey} locked=${locked}, broadcast à wizard:${sheetId}`)
      io.to(`wizard:${sheetId}`).emit(WS.WIZARD_LOCKS_SYNC, { sheetId, locks })
    } catch (err) {
      console.error(`[DBG][Wizard] WIZARD_LOCK_UPDATE échoué — sheetId=${sheetId} :`, err.message, err.stack)
      emitWizardError(socket, 'wizard.errors.accessDenied')
    }
  })

  // WIZARD_LIVE_UPDATE (Lot A4, docs/PLAN_WIZARDCOLLAB.md §2.5/§5bis) : relais pur, jamais persisté ni
  // validé métier — resolveSheetAccess reste la seule garde (identité/droits). `data` est retransmis
  // tel quel : ce canal n'a aucune autorité (distinct de WIZARD_STATE_SYNC), un payload falsifié n'a
  // d'effet que cosmétique chez les autres clients de la room (§9 du plan), jamais lu par
  // reconcileCreation ni par l'enforcement des verrous. `socket.to` (pas `io.to`) exclut l'émetteur —
  // sans ça, chaque client verrait son propre champ se faire "rafraîchir" pendant qu'il tape par-dessus
  // sa propre frappe en cours. Pas de WIZARD_ERROR ici (pas une action explicite de l'utilisateur,
  // contrairement à WIZARD_JOIN/WIZARD_LOCK_UPDATE) — un refus reste silencieux côté client, tracé
  // serveur seulement.
  socket.on(WS.WIZARD_LIVE_UPDATE, async ({ sheetId, step, data }) => {
    if (!Number.isInteger(step) || step < 1 || step > 5 || !data || typeof data !== 'object') return
    try {
      await resolveSheetAccess(sheetId, user.id)
      socket.to(`wizard:${sheetId}`).emit(WS.WIZARD_LIVE_UPDATE, { sheetId, step, data })
    } catch (err) {
      console.warn(`[DBG][Wizard] WIZARD_LIVE_UPDATE refusé — user=${user.id} sheetId=${sheetId} :`, err.message)
    }
  })
}
