import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSocket } from './SocketContext'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useSessionStore } from '../stores/sessionStore'

export function useCombatSocket({ isGm, setMode, onModeReset }) {
  const {
    setCombatState, resetCombat, setPhase, markTokenAnnounced, updateRoster,
    advanceSlot, setActions, addAnnouncedAction, resetAnnouncedActions, setTimelineState,
  } = useCombatStore()
  const { addMessage } = useSessionStore()
  const { t } = useTranslation()

  const [reloadResult,        setReloadResult]        = useState(null)
  const [damagePayload,       setDamagePayload]        = useState(null)
  const [damageResults,       setDamageResults]        = useState(null)
  const [attackResult,        setAttackResult]         = useState(null)
  const [gmAttackResult,      setGmAttackResult]       = useState(null)
  const [pnjAttackResult,     setPnjAttackResult]      = useState(null)
  const [meleeDefensePrompt,  setMeleeDefensePrompt]   = useState(null)
  const [meleeResult,         setMeleeResult]          = useState(null)
  const [stunPayload,         setStunPayload]          = useState(null)
  const [pendingSurpriseRoll, setPendingSurpriseRoll]  = useState(null)
  const [pjPreview,           setPjPreview]            = useState(null)

  const socket = useSocket()

  useEffect(() => {
    if (!socket) return

    const onReloadResult        = (data) => { setReloadResult(data) }
    const onMeleeDefensePrompt  = (data) => { setMeleeDefensePrompt(data) }
    const onMeleeResult         = (data) => { setMeleeResult(data) }
    const onDamagePrompt        = (data) => { setDamagePayload(data) }
    const onDamageResult        = (data) => { setDamageResults(data) }
    const onStunPrompt          = (data) => { setStunPayload(data) }
    const onAttackPlayerResult  = (data) => { setAttackResult(data) }
    const onAttackResult        = (data) => {
      if (data.isPnj) {
        setGmAttackResult(data)
        setPnjAttackResult(data)
      } else if (isGm) {
        setGmAttackResult(data)
      }
    }
    const onCombatStarted = ({ roster, phase }) => {
      setCombatState({ phase, roster, actions: [], currentTurn: 1, activeSlotIdx: 0 })
      setMode('combat')
    }
    const onCombatEnded = () => {
      resetCombat()
      setMode('play')
      // Retour Saar Session 159 (« mauvaise réinitialisation ») : seuls attackResult/reloadResult
      // étaient remis à zéro ici — une fenêtre de dégâts, défense CaC, étourdissement ou résultat PNJ
      // encore ouverte à la fin d'un combat restait affichée (ou logiquement en attente) dans le combat
      // SUIVANT. Un clic dessus ré-émettait une confirmation pour un token/pending qui n'existe plus,
      // rejetée en silence par le garde FSM (`ROSTER|null + COMBAT_DAMAGE_CONFIRM` observé en log) —
      // inoffensif pour les données mais confus pour l'utilisateur. Tous les états de fenêtre/résultat
      // de ce hook sont désormais purgés ensemble, même invariant que attackResult/reloadResult déjà là.
      setAttackResult(null)
      setReloadResult(null)
      setDamagePayload(null)
      setDamageResults(null)
      setGmAttackResult(null)
      setPnjAttackResult(null)
      setMeleeDefensePrompt(null)
      setMeleeResult(null)
      setStunPayload(null)
      setPendingSurpriseRoll(null)
      setPjPreview(null)
      onModeReset()
    }
    const onStateSync = ({ combatState, roster, actions }) => {
      // RESOLUTION : activeTokenId n'est plus dérivable ici depuis active_slot_idx (colonne supprimée,
      // Lot B) — laissé null, corrigé immédiatement par le COMBAT_TIMELINE_UPDATED de reconnexion émis
      // juste après par le serveur (server/src/socket/index.js).
      let activeTokenId = null
      if (combatState.phase === 'ANNOUNCEMENT') {
        activeTokenId = [...roster]
          .filter(r => !r.has_announced && r.status === 'active')
          .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
      }
      setCombatState({
        phase: combatState.phase,
        subPhase: combatState.sub_phase ?? null,
        roster,
        actions,
        currentTurn: combatState.current_turn,
        activeTokenId,
      })
      if (combatState.phase) setMode('combat')  // F-R9-6 : troisième callsite setMode
    }
    const onPhaseChanged = ({ phase, roster, actions }) => {
      setPjPreview(null)
      onModeReset()
      setPhase(phase)
      if (roster) updateRoster(roster)
      if (actions) setActions(actions)
      if (phase === 'ANNOUNCEMENT') {
        setActions([])
        setReloadResult(null)
        setMeleeDefensePrompt(null)
        setMeleeResult(null)
        resetAnnouncedActions()
        // Nouveau Tour — l'échelle du Tour précédent n'a plus lieu d'être affichée, elle sera
        // reconstruite au prochain passage en RESOLUTION (COMBAT_TIMELINE_UPDATED).
        setTimelineState({ entries: [], currentStep: null })
      }
    }
    const onTimelineUpdated = (payload) => { setTimelineState(payload) }
    const onRosterUpdated   = ({ roster }) => { updateRoster(roster) }
    const onSurpriseRoll    = ({ tokenId }) => { setPendingSurpriseRoll({ tokenId }) }
    const onAnnouncePreview = (preview) => { setPjPreview(preview) }
    const onActionDeclared  = ({ tokenId, actionType, initiative, moveTarget, attackTargetId }) => {
      markTokenAnnounced(tokenId, initiative)
      setPjPreview(null)
      addAnnouncedAction({ tokenId, actionType, initiative, moveTarget: moveTarget ?? null, attackTargetId: attackTargetId ?? null })
    }
    const onSlotAdvanced = ({ activeSlotIdx, tokenId }) => { advanceSlot(activeSlotIdx, tokenId) }
    const onTurnSkipped  = ({ tokenId, tokenLabel }) => {
      markTokenAnnounced(tokenId)
      addMessage({
        id: `combat-skip-${tokenId}-${Date.now()}`,
        system: true,
        text: t('session.tokenSkipped', { label: tokenLabel }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }
    const onDeclareError = ({ message, username, stunned, statusCode }) => {
      let text = message
      if (stunned) {
        const statut = statusCode === 'unconscious' ? 'inconscient' : 'étourdi'
        text = t('session.stun_blocked', { statut })
      }
      addMessage({
        id: `combat-error-${Date.now()}`,
        type: 'declare_error',
        text,
        username,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }

    const onResolveMoveBlocked = ({ tokenLabel, partial }) => {
      addMessage({
        id: `combat-move-blocked-${Date.now()}`,
        type: 'resolve_move_blocked',
        text: partial
          ? 'Déplacement partiel — destination occupée'
          : 'Déplacement bloqué — destination occupée',
        username: tokenLabel,
        partial,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    }

    socket.on(WS.COMBAT_RELOAD_RESULT,         onReloadResult)
    socket.on(WS.COMBAT_MELEE_DEFENSE_PROMPT,  onMeleeDefensePrompt)
    socket.on(WS.COMBAT_MELEE_RESULT,          onMeleeResult)
    socket.on(WS.COMBAT_DAMAGE_PROMPT,         onDamagePrompt)
    socket.on(WS.COMBAT_DAMAGE_RESULT,         onDamageResult)
    socket.on(WS.COMBAT_STUN_PROMPT,           onStunPrompt)
    socket.on(WS.COMBAT_ATTACK_PLAYER_RESULT,  onAttackPlayerResult)
    socket.on(WS.COMBAT_ATTACK_RESULT,         onAttackResult)
    socket.on(WS.COMBAT_STARTED,               onCombatStarted)
    socket.on(WS.COMBAT_ENDED,                 onCombatEnded)
    socket.on(WS.COMBAT_STATE_SYNC,            onStateSync)
    socket.on(WS.COMBAT_PHASE_CHANGED,         onPhaseChanged)
    socket.on(WS.COMBAT_ROSTER_UPDATED,        onRosterUpdated)
    socket.on(WS.COMBAT_SURPRISE_ROLL,         onSurpriseRoll)
    socket.on(WS.COMBAT_ANNOUNCE_PREVIEW,      onAnnouncePreview)
    socket.on(WS.COMBAT_ACTION_DECLARED,       onActionDeclared)
    socket.on(WS.COMBAT_SLOT_ADVANCED,         onSlotAdvanced)
    socket.on(WS.COMBAT_TURN_SKIPPED,          onTurnSkipped)
    socket.on(WS.COMBAT_DECLARE_ERROR,         onDeclareError)
    socket.on(WS.COMBAT_RESOLVE_MOVE_BLOCKED,  onResolveMoveBlocked)
    socket.on(WS.COMBAT_TIMELINE_UPDATED,      onTimelineUpdated)

    return () => {
      socket.off(WS.COMBAT_RELOAD_RESULT,        onReloadResult)
      socket.off(WS.COMBAT_MELEE_DEFENSE_PROMPT, onMeleeDefensePrompt)
      socket.off(WS.COMBAT_MELEE_RESULT,         onMeleeResult)
      socket.off(WS.COMBAT_DAMAGE_PROMPT,        onDamagePrompt)
      socket.off(WS.COMBAT_DAMAGE_RESULT,        onDamageResult)
      socket.off(WS.COMBAT_STUN_PROMPT,          onStunPrompt)
      socket.off(WS.COMBAT_ATTACK_PLAYER_RESULT, onAttackPlayerResult)
      socket.off(WS.COMBAT_ATTACK_RESULT,        onAttackResult)
      socket.off(WS.COMBAT_STARTED,              onCombatStarted)
      socket.off(WS.COMBAT_ENDED,                onCombatEnded)
      socket.off(WS.COMBAT_STATE_SYNC,           onStateSync)
      socket.off(WS.COMBAT_PHASE_CHANGED,        onPhaseChanged)
      socket.off(WS.COMBAT_ROSTER_UPDATED,       onRosterUpdated)
      socket.off(WS.COMBAT_SURPRISE_ROLL,        onSurpriseRoll)
      socket.off(WS.COMBAT_ANNOUNCE_PREVIEW,     onAnnouncePreview)
      socket.off(WS.COMBAT_ACTION_DECLARED,      onActionDeclared)
      socket.off(WS.COMBAT_SLOT_ADVANCED,        onSlotAdvanced)
      socket.off(WS.COMBAT_TURN_SKIPPED,         onTurnSkipped)
      socket.off(WS.COMBAT_DECLARE_ERROR,        onDeclareError)
      socket.off(WS.COMBAT_RESOLVE_MOVE_BLOCKED, onResolveMoveBlocked)
      socket.off(WS.COMBAT_TIMELINE_UPDATED,     onTimelineUpdated)
    }
  }, [socket, isGm, setMode, onModeReset])

  return {
    reloadResult,        setReloadResult,
    damagePayload,       setDamagePayload,
    damageResults,       setDamageResults,
    attackResult,        setAttackResult,
    gmAttackResult,      setGmAttackResult,
    pnjAttackResult,     setPnjAttackResult,
    meleeDefensePrompt,  setMeleeDefensePrompt,
    meleeResult,         setMeleeResult,
    stunPayload,         setStunPayload,
    pendingSurpriseRoll, setPendingSurpriseRoll,
    pjPreview,           setPjPreview,
  }
}
