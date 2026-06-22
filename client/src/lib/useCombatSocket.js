import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSocket } from './SocketContext'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useSessionStore } from '../stores/sessionStore'

export function useCombatSocket({ isGm, setMode, onModeReset }) {
  const {
    setCombatState, resetCombat, setPhase, markTokenAnnounced, updateRoster,
    advanceSlot, setActions, addAnnouncedAction, resetAnnouncedActions,
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
  const [announcementMarker,  setAnnouncementMarker]   = useState(null)
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
      setAttackResult(null)
      setReloadResult(null)
      onModeReset()
    }
    const onStateSync = ({ combatState, roster, actions }) => {
      let activeTokenId = null
      if (combatState.phase === 'ANNOUNCEMENT') {
        activeTokenId = [...roster]
          .filter(r => !r.has_announced && r.status === 'active')
          .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
      } else if (combatState.phase === 'RESOLUTION') {
        activeTokenId = [...roster]
          .sort((a, b) => b.initiative - a.initiative)[combatState.active_slot_idx]?.token_id ?? null
      }
      setCombatState({
        phase: combatState.phase,
        subPhase: combatState.sub_phase ?? null,
        roster,
        actions,
        currentTurn: combatState.current_turn,
        activeSlotIdx: combatState.active_slot_idx,
        activeTokenId,
      })
      if (combatState.phase) setMode('combat')  // F-R9-6 : troisième callsite setMode
    }
    const onPhaseChanged = ({ phase, roster, actions }) => {
      setAnnouncementMarker(null)
      setPjPreview(null)
      onModeReset()
      setPhase(phase)
      if (roster) updateRoster(roster)
      if (actions) setActions(actions)
      if (phase === 'ANNOUNCEMENT') {
        setReloadResult(null)
        setMeleeDefensePrompt(null)
        setMeleeResult(null)
        resetAnnouncedActions()
      }
    }
    const onRosterUpdated   = ({ roster }) => { updateRoster(roster) }
    const onSurpriseRoll    = ({ tokenId }) => { setPendingSurpriseRoll({ tokenId }) }
    const onAnnouncePreview = (preview) => { setPjPreview(preview) }
    const onActionDeclared  = ({ tokenId, actionType, initiative, moveTarget, attackTargetId }) => {
      markTokenAnnounced(tokenId, initiative)
      setAnnouncementMarker({ tokenId, moveTarget: moveTarget ?? null, attackTargetId: attackTargetId ?? null })
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
    const onDeclareError = ({ message }) => {
      addMessage({
        id: `combat-error-${Date.now()}`,
        system: true,
        text: `⚠ ${message}`,
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
    announcementMarker,  setAnnouncementMarker,
    pjPreview,           setPjPreview,
  }
}
