import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSocket } from './SocketContext'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useSessionStore } from '../stores/sessionStore'
import {
  pushDamagePrompt, attachDamageResult, dismissDamageQueueHead, currentDamageEntry,
  pushAttackResult, dismissAttackQueueHead, currentAttackResult,
} from './combatDamageQueue.js'

export function useCombatSocket({ isGm, setMode, onModeReset }) {
  const {
    setCombatState, resetCombat, setPhase, markTokenAnnounced, updateRoster,
    advanceSlot, setActions, addAnnouncedAction, resetAnnouncedActions, setTimelineState,
    armGrenadeMarker, removeGrenadeMarker, clearGrenadeMarkers, clearEphemeralGrenadeMarkers,
  } = useCombatStore()
  const { addMessage, setDeclareError, clearDeclareError, declareError } = useSessionStore()
  const { t } = useTranslation()

  const [reloadResult,        setReloadResult]        = useState(null)
  const [gmReloadResult,      setGmReloadResult]      = useState(null)
  // File d'attente (combatDamageQueue.js) — une série d'attaques déclarées ensemble (CaC ou Tir
  // Multi) devient plusieurs entrées d'échelle séparées (declaration_group_id,
  // combatTurnEngine.js::buildTimelineEntries) qui peuvent chacune armer un dégât en attente pour
  // le même tireur avant que le joueur ait fermé le précédent (armAwaitingDamage, 3 sites :
  // resolveMeleeDefenseHitAttackerPj / resolveAttackHitPj / resolveAssaultAction,
  // socketCombatHelpers.js — docs/PLAN_COMBAT_ACTION_QUEUE.md §3). confirmDamage (FIFO) émet le
  // prompt de l'entrée suivante avant le résultat de l'entrée courante ; deux états plats
  // indépendants écrasaient le mauvais côté (COMBAT-DAMAGE-WINDOW-WRONG-TARGET). [Corrigé 2026-10-03
  // après relecture : le commentaire précédent citait `resolveMeleeAction`/`remainingMeleeActions`,
  // une récursion qui n'existe plus depuis le passage à l'échelle de résolution — la vraie source
  // est la série d'entrées ci-dessus, vérifiée en lisant `resolveMeleeAction` (plus aucun paramètre
  // de ce nom) puis `armAwaitingDamage`.]
  const [damageQueue,         setDamageQueue]         = useState([])
  const damageEntry = currentDamageEntry(damageQueue)
  const damagePayload = damageEntry?.payload ?? null
  const damageResults = damageEntry?.results ?? null
  const dismissDamage = () => setDamageQueue(dismissDamageQueueHead)
  // Même défaut, même correctif : chaque entrée de la série peut émettre son propre
  // COMBAT_ATTACK_PLAYER_RESULT (armAwaitingDamage n'émet le prompt de dégâts que si aucune autre
  // entrée n'attendait déjà, mais le résultat toucher/raté lui-même n'a pas ce garde-fou) — un
  // second résultat pouvait écraser silencieusement le premier.
  // [LIMITE CONNUE, non résolue ici] Sur un coup réussi, CombatModifiersWindow n'a pas de bouton
  // Fermer propre (le flux continue vers CombatDamageWindow) : fermer les dégâts (onDamageConfirmed,
  // SessionPage.jsx) dépile aussi cette file, comme le faisait déjà le `setAttackResult(null)`
  // d'origine. Fidèle au comportement précédent pour la séquence réellement signalée (plusieurs
  // touches d'affilée) ; une séquence qui mélangerait un Raté PAS ENCORE fermé par le joueur avec
  // un Touché ultérieur pourrait dépiler la mauvaise entrée (aucun identifiant commun aux deux
  // événements pour les corréler) — pas reproduit, à surveiller en jeu réel plutôt que deviné.
  const [attackQueue,         setAttackQueue]          = useState([])
  const attackResult = currentAttackResult(attackQueue)
  const dismissAttackResult = () => setAttackQueue(dismissAttackQueueHead)
  const [gmAttackResult,      setGmAttackResult]       = useState(null)
  const [targetAttackResult, setTargetAttackResult]    = useState(null)
  const [meleeDefensePrompt,  setMeleeDefensePrompt]   = useState(null)
  const [meleeResult,         setMeleeResult]          = useState(null)
  const [stunPayload,         setStunPayload]          = useState(null)
  const [pendingSurpriseRoll, setPendingSurpriseRoll]  = useState(null)
  const [pjPreview,           setPjPreview]            = useState(null)

  const socket = useSocket()

  useEffect(() => {
    if (!socket) return

    // isPnj (fix session 2026-09-15, socketCombatHelpers.js#resolveReloadAction) : même patron que
    // onAttackResult juste en dessous — un PNJ n'a pas de joueur propriétaire, le serveur broadcast
    // room plutôt que de cibler un socket, chaque client filtre localement.
    const onReloadResult        = (data) => {
      if (data.isPnj) setGmReloadResult(data)
      else setReloadResult(data)
    }
    const onMeleeDefensePrompt  = (data) => { setMeleeDefensePrompt(data) }
    const onMeleeResult         = (data) => { setMeleeResult(data) }
    const onDamagePrompt        = (data) => { setDamageQueue(q => pushDamagePrompt(q, data)) }
    const onDamageResult        = (data) => { setDamageQueue(q => attachDamageResult(q, data)) }
    const onStunPrompt          = (data) => { setStunPayload(data) }
    const onAttackPlayerResult  = (data) => { setAttackQueue(q => pushAttackResult(q, data)) }
    // sourceCode (Acide/Décompression/Feu/Froid, docs/PLAN_FATIGUE_DOMMAGES.md §9/§11) : géré en
    // exclusivité par EnvironmentalResultQueue.jsx (toujours monté, jamais gaté au mode combat, vraie
    // file d'attente) — jamais aussi ici, ce serait un double affichage pendant un combat réel.
    // COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY (2026-10-08) — qui doit VOIR ce résultat ne dépend
    // jamais de qui a tiré (`data.isPnj`, qui ne décrit que l'attaquant) : seul compte « suis-je le
    // MJ ? » ou « suis-je la cible ? » (cibleId), déjà la condition exacte lue par CombatOverlay.jsx
    // pour afficher CombatResultPlayer. Avant ce correctif, un tir PJ (confirmDamage —
    // `resolveDamageConfirmNormalTarget`/Drone/Exo, socketCombatHelpers.js, qui ne posent jamais
    // `isPnj`) ne mettait à jour que l'état MJ : la cible, si c'était un joueur, ne recevait jamais
    // sa fenêtre — ni, par ricochet, WoundReactionDock qui s'ancre sur sa position
    // (useResultPanelRect). On note systématiquement les deux états ; chaque composant choisit déjà
    // lequel lui correspond (`isGm` / `cibleId === playerToken?.id`), aucune raison de refaire ce tri
    // une seconde fois ici.
    const onAttackResult        = (data) => {
      if (data.sourceCode) return
      setGmAttackResult(data)
      setTargetAttackResult(data)
    }
    const onCombatStarted = ({ roster, phase, droneTurnModelGm, droneTurnModelPlayer }) => {
      setCombatState({ phase, roster, actions: [], currentTurn: 1, activeSlotIdx: 0, droneTurnModelGm, droneTurnModelPlayer })
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
      setAttackQueue([])
      setReloadResult(null)
      setGmReloadResult(null)
      setDamageQueue([])
      setGmAttackResult(null)
      setTargetAttackResult(null)
      setMeleeDefensePrompt(null)
      setMeleeResult(null)
      setStunPayload(null)
      setPendingSurpriseRoll(null)
      setPjPreview(null)
      clearDeclareError()
      onModeReset()
    }
    const onStateSync = ({ combatState, roster, actions }) => {
      // Marqueurs de grenades : le serveur ré-émet COMBAT_GRENADE_ARMED juste après pour chaque
      // grenade encore en vol — on repart d'une ardoise vierge pour ne pas garder un marqueur dont
      // l'explosion a eu lieu pendant la coupure (§3d-3).
      clearGrenadeMarkers()
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
        droneTurnModelGm: combatState.drone_turn_model_gm ?? null,
        droneTurnModelPlayer: combatState.drone_turn_model_player ?? null,
      })
      clearDeclareError()  // reconnexion — une bannière de refus d'avant la coupure n'a plus de sens
      if (combatState.phase) setMode('combat')  // F-R9-6 : troisième callsite setMode
    }
    const onPhaseChanged = ({ phase, roster, actions }) => {
      setPjPreview(null)
      clearDeclareError()
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
        // Marqueurs de grenade éphémères (percussion, §3f) : la grenade a explosé au Tour écoulé,
        // le marqueur ne survit pas au changement de Tour. Les marqueurs de minuterie (non `ephemeral`)
        // survivent — ils explosent T+1 et s'effacent sur COMBAT_GRENADE_EXPLODED.
        clearEphemeralGrenadeMarkers()
      }
    }
    const onTimelineUpdated = (payload) => { setTimelineState(payload) }
    const onGrenadeArmed    = (marker) => { armGrenadeMarker(marker) }
    const onGrenadeExploded = ({ entryId }) => { removeGrenadeMarker(entryId) }
    const onRosterUpdated   = ({ roster }) => { updateRoster(roster) }
    const onSurpriseRoll    = ({ tokenId }) => { setPendingSurpriseRoll({ tokenId }) }
    const onAnnouncePreview = (preview) => { setPjPreview(preview) }
    const onActionDeclared  = ({ tokenId, actionType, initiative, moveTarget, attackTargetId }) => {
      markTokenAnnounced(tokenId, initiative)
      setPjPreview(null)
      addAnnouncedAction({ tokenId, actionType, initiative, moveTarget: moveTarget ?? null, attackTargetId: attackTargetId ?? null })
    }
    // onModeReset avant advanceSlot — le survol/ciblage combat (combatMoveMode/combatTargetMode) était
    // armé pour l'ancien token actif et ne se réinitialisait jamais au changement de slot (seuls
    // onPhaseChanged/onStateSync l'appelaient) : useAutoMoveMode refuse de réarmer tant que
    // combatMoveMode reste non-null, donc le survol restait calé sur le token précédent — cases
    // erronées signalées par Saar 2026-07-31.
    const onSlotAdvanced = ({ activeSlotIdx, tokenId }) => { clearDeclareError(); onModeReset(); advanceSlot(activeSlotIdx, tokenId) }
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
        // Libellé du statut lu dans `status.<code>` (mêmes clés que le panneau) — plus de branche par code :
        // stunned → « étourdi », unconscious → « inconscient », dead → « mort ».
        const statut = t(`status.${statusCode ?? 'stunned'}`).toLowerCase()
        text = t('session.stun_blocked', { statut })
      }
      addMessage({
        id: `combat-error-${Date.now()}`,
        type: 'declare_error',
        text,
        username,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
      // Bannière transitoire dans le pied de la fenêtre de déclaration active (module 3) — le même
      // événement alimente le chat (ci-dessus) ET la bannière ; les fenêtres n'ouvrent plus leur
      // propre socket.on (REACT.md P57).
      setDeclareError(text)
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
    socket.on(WS.COMBAT_GRENADE_ARMED,         onGrenadeArmed)
    socket.on(WS.COMBAT_GRENADE_EXPLODED,      onGrenadeExploded)

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
      socket.off(WS.COMBAT_GRENADE_ARMED,        onGrenadeArmed)
      socket.off(WS.COMBAT_GRENADE_EXPLODED,     onGrenadeExploded)
    }
  }, [socket, isGm, setMode, onModeReset])

  // Auto-effacement de la bannière de refus de déclaration après 4 s (sessionStore.declareError).
  // Centralisé ici — hook monté toute la session — plutôt que dans CombatDeclareErrorBanner, monté
  // par intermittence (un démontage en cours de compte à rebours laisserait la bannière figée dans
  // le store). Même rôle que le setTimeout de CriticalEffectOverlay.jsx, relogé au bon niveau.
  useEffect(() => {
    if (!declareError) return
    const timer = setTimeout(clearDeclareError, 4000)
    return () => clearTimeout(timer)
  }, [declareError, clearDeclareError])

  return {
    reloadResult,        setReloadResult,
    gmReloadResult,      setGmReloadResult,
    damagePayload,
    damageResults,
    dismissDamage,
    attackResult,
    dismissAttackResult,
    gmAttackResult,      setGmAttackResult,
    targetAttackResult,  setTargetAttackResult,
    meleeDefensePrompt,  setMeleeDefensePrompt,
    meleeResult,         setMeleeResult,
    stunPayload,         setStunPayload,
    pendingSurpriseRoll, setPendingSurpriseRoll,
    pjPreview,           setPjPreview,
  }
}
