import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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

  function listen(s) {
    s.on(WS.COMBAT_RELOAD_RESULT, (data) => {
      setReloadResult(data)
    })
    s.on(WS.COMBAT_MELEE_DEFENSE_PROMPT, (data) => {
      setMeleeDefensePrompt(data)
    })
    s.on(WS.COMBAT_MELEE_RESULT, (data) => {
      setMeleeResult(data)
    })
    s.on(WS.COMBAT_DAMAGE_PROMPT, (data) => {
      setDamagePayload(data)
    })
    s.on(WS.COMBAT_DAMAGE_RESULT, (data) => {
      setDamageResults(data)
    })
    s.on(WS.COMBAT_STUN_PROMPT, (data) => {
      setStunPayload(data)
    })
    s.on(WS.COMBAT_ATTACK_PLAYER_RESULT, (data) => {
      setAttackResult(data)
    })
    s.on(WS.COMBAT_ATTACK_RESULT, (data) => {
      if (data.isPnj) {
        setGmAttackResult(data)
        setPnjAttackResult(data)
      } else if (isGm) {
        setGmAttackResult(data)
      }
    })
    s.on(WS.COMBAT_STARTED, ({ roster, phase }) => {
      setCombatState({ phase, roster, actions: [], currentTurn: 1, activeSlotIdx: 0 })
      setMode('combat')
    })
    s.on(WS.COMBAT_ENDED, () => {
      resetCombat()
      setMode('play')
      setAttackResult(null)
      setReloadResult(null)
      onModeReset()
    })
    s.on(WS.COMBAT_STATE_SYNC, ({ combatState, roster, actions }) => {
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
        roster,
        actions,
        currentTurn: combatState.current_turn,
        activeSlotIdx: combatState.active_slot_idx,
        activeTokenId,
      })
      if (combatState.phase) setMode('combat')  // F-R9-6 : troisième callsite setMode
    })
    s.on(WS.COMBAT_PHASE_CHANGED, ({ phase, roster, actions }) => {
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
    })
    s.on(WS.COMBAT_ROSTER_UPDATED, ({ roster }) => {
      updateRoster(roster)
    })
    s.on(WS.COMBAT_SURPRISE_ROLL, ({ tokenId }) => {
      setPendingSurpriseRoll({ tokenId })
    })
    s.on(WS.COMBAT_ANNOUNCE_PREVIEW, (preview) => {
      setPjPreview(preview)
    })
    s.on(WS.COMBAT_ACTION_DECLARED, ({ tokenId, actionType, initiative, moveTarget, attackTargetId }) => {
      markTokenAnnounced(tokenId, initiative)
      setAnnouncementMarker({ tokenId, moveTarget: moveTarget ?? null, attackTargetId: attackTargetId ?? null })
      setPjPreview(null)
      addAnnouncedAction({ tokenId, actionType, initiative, moveTarget: moveTarget ?? null, attackTargetId: attackTargetId ?? null })
    })
    s.on(WS.COMBAT_SLOT_ADVANCED, ({ activeSlotIdx, tokenId }) => {
      advanceSlot(activeSlotIdx, tokenId)
    })
    s.on(WS.COMBAT_TURN_SKIPPED, ({ tokenId, tokenLabel }) => {
      markTokenAnnounced(tokenId)
      addMessage({
        id: `combat-skip-${tokenId}-${Date.now()}`,
        system: true,
        text: t('session.tokenSkipped', { label: tokenLabel }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })
  }

  return {
    listen,
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
