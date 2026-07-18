import { useState, useEffect } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import CombatRosterWindow from './CombatRosterWindow'
import CombatTimeline from './CombatTimeline'
import CombatActionWindow from './CombatActionWindow'
import CombatPnjPanel from './CombatPnjPanel'
import CombatGmDeclareWindow from './CombatGmDeclareWindow'
import CombatModifiersWindow from './CombatModifiersWindow'
import CombatCacModifiersWindow from './CombatCacModifiersWindow'
import CombatDamageWindow from './CombatDamageWindow'
import CombatStunWindow from './CombatStunWindow'
import CombatInitStateWindow from './CombatInitStateWindow'
import { MOVE_ZONE_DEFS } from './combatSections.js'
import { CombatResultGM, CombatResultPlayer, CombatResultReload, CombatResultMelee } from './CombatResultPanels'

export default function CombatOverlay({ socket, battlemap, isGm, user, characters, actionTimerSec, pendingSurpriseRoll, onSurpriseRolled, onEnterMoveMode, combatMoveMode, pendingMoveSelection, onValidateMove, onCancelPendingMove, combatTargetMode, onEnterTargetMode, onValidateTarget, damagePayload, damageResults, onDamageConfirmed, attackResult, onAttackConfirmed, gmAttackResult, onGmAttackResultClose, pnjAttackResult, onPnjAttackResultClose, reloadResult, onReloadResultClose, meleeDefensePrompt, onMeleeDefenseConfirm, meleeResult, onMeleeResultClose, stunPayload, onStunConfirmed, gmSocketError, onGmSocketErrorClose, pjPreview, sidebarWidth = 0 }) {
  const { phase, subPhase, roster, activeTokenId, actions, currentStep, timelineEntries } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const myTokenIds = isGm ? null : characters.filter(c => c.user_id === user?.id).map(c => tokens.find(t => t.character_id === c.id)?.id).filter(Boolean)
  // Retarder décale l'Action vers plus tard, jamais plus tôt (RAW REGLESYSCOMBAT.md:554-567, retour
  // Saar Session 159) — n'afficher le panneau « Agir maintenant » que si le pas normal à résoudre a
  // atteint (ou dépassé) la propre phase d'Initiative d'origine du personnage en délai.
  const myControllableDelayedTokenIds = [...new Set(timelineEntries.filter(e => e.status === 'delayed_waiting').map(e => e.token_id))]
    .filter(tokenId => isGm || (myTokenIds?.includes(tokenId) ?? false))
    .filter(tokenId => {
      const ownPosition = (roster.find(r => r.token_id === tokenId)?.initiative ?? 0) * 100
      return currentStep?.position != null && currentStep.position <= ownPosition
    })
  const [showGmPanel, setShowGmPanel] = useState(false)
  const [stunDialog, setStunDialog] = useState(null) // null | { tokenId, outcome }
  const [stunDialogDuration, setStunDialogDuration] = useState('')
  // Écoute expiry étourdissement — notification simple
  useEffect(() => {
    if (!socket) return
    const handler = ({ tokenId }) => {
      const token = tokens.find(t => t.id === tokenId)
      console.log(`[Combat] Étourdissement expiré — ${token?.label ?? tokenId}`)
    }
    socket.on(WS.COMBAT_STUN_EXPIRED, handler)
    return () => socket.off(WS.COMBAT_STUN_EXPIRED, handler)
  }, [socket, tokens])

  const [precheckRetryKey, setPrecheckRetryKey] = useState(0)
  useEffect(() => {
    if (!socket) return
    const onAttackResult = () => setPrecheckRetryKey(k => k + 1)
    socket.on(WS.COMBAT_ATTACK_RESULT, onAttackResult)
    return () => socket.off(WS.COMBAT_ATTACK_RESULT, onAttackResult)
  }, [socket])

  // Slot actif en RÉSOLUTION — pour le panneau GM
  const sortedRoster = [...roster].sort((a, b) => b.initiative - a.initiative)
  const gmActiveEntry = roster.find(e => e.token_id === activeTokenId) ?? null
  const gmActiveToken = gmActiveEntry ? tokens.find(t => t.id === gmActiveEntry.token_id) : null
  const gmActiveCharacter = gmActiveToken ? characters.find(c => c.id === gmActiveToken.character_id) : null
  // `currentStep?.kind !== 'delayed_turn'` (Session 159, retour Saar — « Plantage, pas d'action du
  // joueur ») : `activeTokenId` dérive de `currentStep.tokenId` quel que soit son `kind`, y compris au
  // tour obligatoire de fin de Tour d'un personnage en délai — sans cette garde (déjà présente côté
  // CaC ci-dessous, jamais portée côté Tir), la fenêtre de modificateurs d'assaut s'ouvrait par-dessus
  // le panneau dédié Agir maintenant/Passer. Un clic sur « Valider » envoyait un `COMBAT_ACTION_CONFIRM`
  // pour une entrée toujours `delayed_waiting` (jamais repositionnée par Agir maintenant) — rejeté par
  // le garde serveur (`step.tokenId !== tokenId`) sans que rien ne se passe à l'écran, indiscernable
  // d'un blocage réel.
  const activeAssaultAction = (gmActiveEntry && currentStep?.kind !== 'delayed_turn')
    ? actions.find(a => a.token_id === gmActiveEntry.token_id && a.action_key === 'assault')
    : null
  // Action melee PNJ/drone active (GM) — CombatCacModifiersWindow remplace le bouton "Agir" bare.
  // docs/PLAN_COMBAT_TIMELINE.md Lot B : un token peut avoir plusieurs lignes combat_actions type=melee
  // encore 'pending' simultanément (série CaC non intégralement résolue, chaque attaque étant sa propre
  // entrée d'échelle) — .find() sur token_id+action_key seul prendrait la première de l'array, pas
  // forcément celle réellement due. currentStep.entry.combat_action_id désigne l'entrée exacte en cours.
  const activeMeleeAction = (gmActiveEntry && currentStep?.kind === 'entry' && currentStep.tokenId === gmActiveEntry.token_id)
    ? actions.find(a => a.id === currentStep.entry.combat_action_id && a.action_key === 'melee')
    : null

  // Slot actif PJ — fenêtre modificateurs côté joueur
  const playerCharacter = !isGm ? characters.find(c => c.user_id === user?.id) : null
  const playerToken = playerCharacter ? tokens.find(t => t.character_id === playerCharacter.id) : null
  const playerRosterEntry = playerToken ? sortedRoster.find(e => e.token_id === playerToken.id) : null
  const playerActiveAssaultAction = (phase === 'RESOLUTION' && activeTokenId === playerToken?.id && currentStep?.kind !== 'delayed_turn')
    ? actions.find(a => a.token_id === playerToken?.id && a.action_key === 'assault')
    : null
  // Action melee PJ active — CombatCacModifiersWindow remplace CombatActionWindow. Même garde que côté
  // GM ci-dessus (currentStep.entry.combat_action_id, pas token_id+action_key seul).
  const playerActiveMeleeAction = (phase === 'RESOLUTION' && currentStep?.kind === 'entry' && currentStep.tokenId === playerToken?.id)
    ? actions.find(a => a.id === currentStep.entry.combat_action_id && a.action_key === 'melee')
    : null

  // Pre-validation CaC — REWORK-16
  const meleePrecheckId = activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null
  const [precheckOk, setPrecheckOk] = useState(null) // null=en attente | true=ok | false=rejeté

  useEffect(() => {
    setPrecheckOk(null)
    if (!meleePrecheckId || !socket) return
    let cancelled = false
    const tokenId = activeMeleeAction?.token_id ?? playerActiveMeleeAction?.token_id
    socket.timeout(5000).emit(WS.COMBAT_ACTION_PRECHECK, { tokenId, actionKey: 'melee' }, (err, { ok, awaiting } = {}) => {
      if (cancelled) return
      if (awaiting) { setPrecheckOk(null); return }
      setPrecheckOk(err ? false : (ok ?? false))
    })
    return () => { cancelled = true }
  // subPhase en dépendance (pas seulement precheckRetryKey/COMBAT_ATTACK_RESULT) : un precheck rejeté
  // en `awaiting` par une fenêtre de réaction/défense/dégâts transitoire (Session 159) doit se retenter
  // dès la fermeture de cette fenêtre, pas seulement après une attaque effectivement confirmée.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meleePrecheckId, socket, precheckRetryKey, subPhase])

  // Pre-validation assaut distance — REWORK-16 extension
  const assaultPrecheckId = activeAssaultAction?.id ?? playerActiveAssaultAction?.id ?? null
  const [assaultPrecheckOk, setAssaultPrecheckOk] = useState(null)

  useEffect(() => {
    setAssaultPrecheckOk(null)
    if (!assaultPrecheckId || !socket) return
    let cancelled = false
    const tokenId = activeAssaultAction?.token_id ?? playerActiveAssaultAction?.token_id
    socket.timeout(5000).emit(WS.COMBAT_ACTION_PRECHECK, { tokenId, actionKey: 'assault' }, (err, { ok, stunned, awaiting } = {}) => {
      if (cancelled) return
      if (stunned || awaiting) { setAssaultPrecheckOk(null); return }
      setAssaultPrecheckOk(err ? false : (ok ?? false))
    })
    return () => { cancelled = true }
  // subPhase en dépendance — même raison que meleePrecheckId ci-dessus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assaultPrecheckId, socket, precheckRetryKey, subPhase])

  return (
    <div style={{ ...styles.overlay, '--sidebar-w': sidebarWidth + 'px' }}>

      {/* Timeline — visible à tous dès que le combat est actif */}
      {phase && (
        <CombatTimeline
          characters={characters}
          topOffset={isGm ? 40 : 0}
          onPortraitClick={isGm && phase === 'ANNOUNCEMENT' ? () => setShowGmPanel(p => !p) : undefined}
          actionTimerSec={actionTimerSec ?? 0}
          socket={socket}
          isGm={isGm}
          myTokenIds={myTokenIds}
        />
      )}

      {/* Phase ROSTER — fenêtre état initial pour les joueurs */}
      {!isGm && phase === 'ROSTER' && playerToken && playerRosterEntry && (
        <CombatInitStateWindow socket={socket} playerToken={playerToken} />
      )}

      {/* Roster — GM uniquement, avant démarrage ou pendant phase ROSTER */}
      {isGm && (phase === null || phase === 'ROSTER') && (
        <CombatRosterWindow
          socket={socket}
          battlemapId={battlemap?.id}
          characters={characters}
        />
      )}

      {/* Phase ANNOUNCEMENT — "⚔ Phase Annonce" overview (clic portrait → toggle) */}
      {isGm && phase === 'ANNOUNCEMENT' && (
        <CombatPnjPanel
          isOpen={showGmPanel}
          onClose={() => setShowGmPanel(false)}
          socket={socket}
          characters={characters}
        />
      )}

      {/* Phase ANNOUNCEMENT — fenêtre GM pour déclarer les actions des PNJs */}
      {isGm && phase === 'ANNOUNCEMENT' && (
        <CombatGmDeclareWindow
          socket={socket}
          characters={characters}
          onEnterMoveMode={onEnterMoveMode}
          battlemapId={battlemap?.id}
          onEnterTargetMode={onEnterTargetMode}
          combatTargetMode={combatTargetMode}
          pjPreview={pjPreview}
        />
      )}

      {/* ANNOUNCEMENT + RÉSOLUTION — fenêtre d'action pour les joueurs
          Masquée pendant la résolution d'un assaut PJ (CombatModifiersWindow prend le relais) et
          pendant le tour obligatoire d'un token en délai (panneau Agir maintenant/Passer dédié
          ci-dessus, docs/PLAN_COMBAT_TIMELINE.md §6 point 2). */}
      {!isGm && (phase === 'ANNOUNCEMENT' || (phase === 'RESOLUTION' && !playerActiveAssaultAction && !playerActiveMeleeAction && !attackResult && currentStep?.kind !== 'delayed_turn')) && (
        <CombatActionWindow
          socket={socket}
          user={user}
          characters={characters}
          pendingSurpriseRoll={pendingSurpriseRoll}
          onSurpriseRolled={onSurpriseRolled}
          onEnterMoveMode={onEnterMoveMode}
          onEnterTargetMode={onEnterTargetMode}
        />
      )}

      {/* Phase RÉSOLUTION — tour obligatoire de fin de Tour pour un personnage en délai (docs/
          PLAN_COMBAT_TIMELINE.md §6 point 2) : réponse explicite requise, Agir maintenant ou Passer,
          jamais d'expiration silencieuse. Le MJ peut déclencher pour n'importe lequel de ses tokens
          (comme COMBAT_ACTION_CONFIRM), le joueur uniquement pour le sien. */}
      {phase === 'RESOLUTION' && currentStep?.kind === 'delayed_turn' && (isGm || currentStep.tokenId === playerToken?.id) && (
        <div style={styles.gmResolution}>
          <div style={styles.gmResolutionLabel}>
            <strong>{tokens.find(t => t.id === currentStep.tokenId)?.label ?? '?'}</strong> — action retardée
          </div>
          <button
            className="btn btn-gold"
            style={{ flexShrink: 0 }}
            onClick={() => socket?.emit(WS.COMBAT_ACT_NOW, { tokenId: currentStep.tokenId })}
          >
            Agir maintenant
          </button>
          <button
            className="btn btn-ghost"
            style={{ flexShrink: 0 }}
            onClick={() => socket?.emit(WS.COMBAT_DELAYED_PASS, { tokenId: currentStep.tokenId })}
          >
            Passer
          </button>
        </div>
      )}

      {/* Phase RÉSOLUTION — Retarder son Action en plein Tour (RAW REGLESYSCOMBAT.md:554-567, refonte
          Session 159 : « agir à n'importe quelle phase d'Action », pas de minuteur). Un ou plusieurs
          personnages en délai peuvent agir immédiatement avant que le pas normal suivant ne se
          résolve, tant que la Résolution est en SLOT_ACTIVE — un panneau explicite, un par personnage
          contrôlé par ce viewer, comme le tour obligatoire ci-dessus. Exclu pendant le tour obligatoire
          (currentStep.kind === 'delayed_turn', panneau dédié ci-dessus) pour ne pas dupliquer le
          bouton. Pas de bouton Passer ici — Passer n'a de sens qu'au tour obligatoire
          (triggerDelayedPass rejette sinon). */}
      {phase === 'RESOLUTION' && subPhase === 'SLOT_ACTIVE' && currentStep?.kind !== 'delayed_turn' && myControllableDelayedTokenIds.map(tokenId => (
        <div key={tokenId} style={styles.gmResolution}>
          <div style={styles.gmResolutionLabel}>
            <strong>{tokens.find(t => t.id === tokenId)?.label ?? '?'}</strong> — action retardée : agir maintenant, avant la suite ?
          </div>
          <button
            className="btn btn-gold"
            style={{ flexShrink: 0 }}
            onClick={() => socket?.emit(WS.COMBAT_ACT_NOW, { tokenId })}
          >
            Agir maintenant
          </button>
        </div>
      ))}

      {/* Phase RÉSOLUTION — outil MJ générique « forcer la suite de l'étape en cours » (docs/
          PLAN_COMBAT_TIMELINE.md Lot D, §6quinquies point 4) : un joueur ne répond pas à un prompt de
          défense/dégâts (le MJ n'a aujourd'hui aucune visibilité sur ces prompts, envoyés uniquement au
          joueur concerné). Même événement que Passer (COMBAT_SKIP_PLAYER), le serveur décide seul du
          comportement exact selon le sous-état. */}
      {isGm && phase === 'RESOLUTION' && ['AWAITING_DEFENSE', 'AWAITING_DAMAGE'].includes(subPhase) && (
        <div style={styles.gmResolution}>
          <div style={styles.gmResolutionLabel}>
            {subPhase === 'AWAITING_DEFENSE' && 'En attente du jet de défense d’un joueur…'}
            {subPhase === 'AWAITING_DAMAGE' && 'En attente du jet de dégâts d’un joueur…'}
          </div>
          <button
            className="btn btn-ghost"
            style={{ flexShrink: 0 }}
            title="Le serveur lance les dés à la place du joueur injoignable"
            onClick={() => socket?.emit(WS.COMBAT_SKIP_PLAYER, {})}
          >
            Forcer
          </button>
        </div>
      )}

      {/* Phase RÉSOLUTION — panneau GM : confirmer le slot actif (hors assaut distance LOS ok, drone CaC
          qui suit le même flow que CaC humanoïde, ou tour obligatoire d'un token en délai — panneau
          dédié ci-dessus) */}
      {isGm && phase === 'RESOLUTION' && gmActiveEntry && currentStep?.kind !== 'delayed_turn' && (!activeAssaultAction || assaultPrecheckOk === false) && (!activeMeleeAction || precheckOk === false) && (
        <div style={styles.gmResolution}>
          <div style={styles.gmResolutionLabel}>
            Slot actif : <strong>{gmActiveToken?.label ?? '?'}</strong>
            <span style={styles.gmResolutionIni}> INI {gmActiveEntry.initiative}</span>
          </div>
          <button
            className="btn btn-gold"
            style={{ flexShrink: 0 }}
            onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: gmActiveEntry.token_id })}
          >
            Agir
          </button>
        </div>
      )}

      {/* Phase RÉSOLUTION — modificateurs assaut PJ (joueur résout lui-même) */}
      {!isGm && phase === 'RESOLUTION' && ((playerActiveAssaultAction && assaultPrecheckOk === true) || attackResult) && (
        <CombatModifiersWindow
          socket={socket}
          assaultAction={playerActiveAssaultAction}
          activeRosterEntry={playerRosterEntry}
          attackResult={attackResult}
          onAttackConfirmed={onAttackConfirmed}
        />
      )}

      {/* Phase RÉSOLUTION — avertissement LOS bloquée (assaut distance PJ) */}
      {!isGm && phase === 'RESOLUTION' && playerActiveAssaultAction && assaultPrecheckOk === false && (
        <div style={styles.losBlockedWarning}>
          <div style={styles.losBlockedTitle}>Ligne de vue bouchée</div>
          <div style={styles.losBlockedMsg}>Vous avez tiré sans espoir d&apos;atteindre votre cible.</div>
          <button
            className="btn"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: playerToken.id })}
          >
            Continuer
          </button>
        </div>
      )}

      {/* Phase RÉSOLUTION — modificateurs assaut distance GM (PNJ ou drone ranged) */}
      {isGm && phase === 'RESOLUTION' && activeAssaultAction && assaultPrecheckOk === true && gmActiveEntry && gmActiveCharacter?.type !== 'pj' && (
        <CombatModifiersWindow
          socket={socket}
          assaultAction={activeAssaultAction}
          activeRosterEntry={gmActiveEntry}
        />
      )}

      {/* Phase RÉSOLUTION — CaC humanoïde PNJ ou drone (GM) */}
      {isGm && phase === 'RESOLUTION' && activeMeleeAction && gmActiveCharacter?.type !== 'pj' && precheckOk === true && (
        <CombatCacModifiersWindow
          socket={socket}
          activeRosterEntry={gmActiveEntry}
          isDrone={gmActiveCharacter?.type === 'drone'}
        />
      )}

      {/* Phase RÉSOLUTION — CaC PJ (joueur) */}
      {!isGm && phase === 'RESOLUTION' && playerActiveMeleeAction && precheckOk === true && (
        <CombatCacModifiersWindow
          socket={socket}
          activeRosterEntry={playerRosterEntry}
          isDrone={false}
        />
      )}

      {/* Panneau visée assaut — visible pendant le mode sélection cible */}
      {combatTargetMode && (
        <div style={combatTargetMode.pendingTargetScreenPos
          ? { ...styles.moveLegend, position: 'fixed', left: `clamp(8px, ${combatTargetMode.pendingTargetScreenPos.x - 110}px, calc(100vw - 228px))`, top: `clamp(8px, ${combatTargetMode.pendingTargetScreenPos.y + 16}px, calc(100vh - 160px))`, bottom: 'auto', right: 'auto' }
          : styles.moveLegend}>
          <div style={styles.moveLegendTitle}>
            {combatTargetMode.mode === 'melee' ? 'Corps à corps — Cliquez sur la cible' : 'Assaut — Cliquez sur la cible'}
          </div>

          {combatTargetMode.pendingTargetId && (() => {
            const tgt = tokens.find(t => t.id === combatTargetMode.pendingTargetId)
            return (
              <div style={styles.movePending}>
                <div style={styles.movePendingInfo}>
                  <span style={styles.movePendingDest}>{tgt?.label ?? '?'}</span>
                </div>
                <div style={styles.movePendingBtns}>
                  <button className="btn" style={{ flex: 1 }} onClick={onValidateTarget}>Valider</button>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => combatTargetMode.onPendingTarget(null)}>Changer</button>
                </div>
              </div>
            )
          })()}

          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => combatTargetMode.onCancel()}>
            Annuler
          </button>
        </div>
      )}

      {/* Fenêtre "Gestion des dégâts" — PJ uniquement, après un toucher */}
      {damagePayload && (
        <CombatDamageWindow
          payload={damagePayload}
          results={damageResults}
          socket={socket}
          onConfirmed={onDamageConfirmed}
        />
      )}

      {/* Fenêtre durée étourdissement — PJ cible interactif (ou GM pour PNJ si shock_auto_stun=false) */}
      {stunPayload && (
        <CombatStunWindow
          payload={stunPayload}
          socket={socket}
          onClose={() => onStunConfirmed()}
        />
      )}

      {/* Bannière d'erreur serveur — GM uniquement */}
      {gmSocketError && (
        <div style={styles.gmError}>
          <span style={styles.gmErrorMsg}>⚠ {gmSocketError}</span>
          <button style={styles.gmErrorClose} onClick={onGmSocketErrorClose}>✕</button>
        </div>
      )}

      {/* Panneau résultat assaut PNJ — GM uniquement, après résolution auto */}
      {isGm && gmAttackResult && (
        <CombatResultGM
          attaquant={tokens.find(t => t.id === gmAttackResult.tireurId)?.label ?? '?'}
          cible={tokens.find(t => t.id === gmAttackResult.cibleId)?.label ?? '?'}
          isSuccess={gmAttackResult.isSuccess}
          roll={gmAttackResult.roll}
          seuil={gmAttackResult.chancesDeReussite}
          localisation={gmAttackResult.localisation}
          degatsBruts={gmAttackResult.degautsBruts}
          degatsNets={gmAttackResult.degatsNets}
          severity={gmAttackResult.severity}
          is_lethal={gmAttackResult.is_lethal}
          shockResult={gmAttackResult.shockResult}
          onClose={onGmAttackResultClose}
          onApplyStun={
            gmAttackResult.shockResult?.stun_applied === false
              ? () => { setStunDialogDuration(''); setStunDialog({ tokenId: gmAttackResult.cibleId, outcome: gmAttackResult.shockResult.outcome }) }
              : undefined
          }
        />
      )}

      {/* Panneau résultat assaut PNJ — Joueur ciblé uniquement */}
      {!isGm && pnjAttackResult && pnjAttackResult.cibleId === playerToken?.id && (
        <CombatResultPlayer
          attaquant={tokens.find(t => t.id === pnjAttackResult.tireurId)?.label ?? '?'}
          isSuccess={pnjAttackResult.isSuccess}
          roll={pnjAttackResult.roll}
          seuil={pnjAttackResult.chancesDeReussite}
          localisation={pnjAttackResult.localisation}
          degatsBruts={pnjAttackResult.degautsBruts}
          degatsNets={pnjAttackResult.degatsNets}
          severity={pnjAttackResult.severity}
          is_lethal={pnjAttackResult.is_lethal}
          shockResult={pnjAttackResult.shockResult}
          onClose={onPnjAttackResultClose}
        />
      )}

      {/* Résultat rechargement — joueur rechargeur uniquement, persistant après avance du slot */}
      {!isGm && reloadResult && reloadResult.characterId === playerCharacter?.id && (
        <CombatResultReload result={reloadResult} onClose={onReloadResultClose} />
      )}

      {/* Prompt défense corps à corps — défenseur PJ uniquement */}
      {!isGm && meleeDefensePrompt && meleeDefensePrompt.defenderTokenId === playerToken?.id && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 280,
          background: '#16162a',
          border: '2px solid #c05050',
          borderRadius: 8,
          padding: '18px 16px 14px',
          boxShadow: '0 0 40px rgba(192,80,80,0.4), 0 12px 32px rgba(0,0,0,0.7)',
          color: '#c0c0d0',
          pointerEvents: 'auto',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 10,
        }}>
          <div style={{ fontSize: 9, color: '#c05050', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
            Corps à corps — Défense !
          </div>
          <div style={{ fontSize: 14, color: '#e8e8f5', fontWeight: 600, marginBottom: 10, lineHeight: 1.3 }}>
            <span style={{ color: '#e07070' }}>{meleeDefensePrompt.attackerName}</span> vous attaque !
          </div>
          {!!meleeDefensePrompt.multiMalusDefenseur && (
            <div style={{ fontSize: 10, color: '#e0a040', background: 'rgba(224,160,64,0.08)', border: '1px solid rgba(224,160,64,0.25)', borderRadius: 3, padding: '4px 7px', marginBottom: 8 }}>
              ⚠ Encerclé — malus {meleeDefensePrompt.multiMalusDefenseur} à votre défense
            </div>
          )}
          <div style={{ fontSize: 11, color: '#7a7a90', marginBottom: 14 }}>
            Son jet d&apos;attaque : <span style={{ color: '#c0c0d0', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{meleeDefensePrompt.rollAttaque}</span>
            {' '}/ seuil{' '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{meleeDefensePrompt.chancesAttaque}</span>
          </div>
          <button
            className="btn"
            style={{ width: '100%' }}
            onClick={onMeleeDefenseConfirm}
          >
            Défendre
          </button>
        </div>
      )}

      {/* Résultat corps à corps — attaquant et défenseur, bottom-right */}
      {meleeResult && (
        <CombatResultMelee
          attaquant={tokens.find(t => t.id === meleeResult.attaquantId)?.label ?? '?'}
          defenseur={tokens.find(t => t.id === meleeResult.defenseurId)?.label ?? '?'}
          rollAttaque={meleeResult.rollAttaque}
          chancesAttaque={meleeResult.chancesAttaque}
          rollDefense={meleeResult.rollDefense}
          chanceDefense={meleeResult.chanceDefense}
          hit={meleeResult.hit}
          multiMalusAttaquant={meleeResult.multiMalusAttaquant}
          multiMalusDefenseur={meleeResult.multiMalusDefenseur}
          onClose={onMeleeResultClose}
        />
      )}

      {/* Panneau légende déplacement — visible pendant le mode sélection destination */}
      {combatMoveMode && (
        <div style={pendingMoveSelection?.screenX != null
          ? { ...styles.moveLegend, position: 'fixed', left: `clamp(8px, ${pendingMoveSelection.screenX - 110}px, calc(100vw - 228px))`, top: `clamp(8px, ${pendingMoveSelection.screenY + 16}px, calc(100vh - 200px))`, bottom: 'auto', right: 'auto' }
          : styles.moveLegend}>
          <div style={styles.moveLegendTitle}>Déplacement</div>

          {MOVE_ZONE_DEFS.map(def => {
            const dist  = combatMoveMode.allures?.[def.allureKey]
            const iniStr = def.ini_mod > 0 ? `+${def.ini_mod}` : def.ini_mod === 0 ? '±0' : `${def.ini_mod}`
            return (
              <div key={def.action_key} style={styles.moveLegendRow}>
                <span style={{ ...styles.moveLegendDot, background: def.color }} />
                <span style={styles.moveLegendLabel}>{def.label}</span>
                <span style={styles.moveLegendDist}>≤ {dist} m</span>
                <span style={styles.moveLegendIni}>{iniStr}</span>
              </div>
            )
          })}

          {pendingMoveSelection && (
            <div style={styles.movePending}>
              <div style={styles.movePendingInfo}>
                <span style={styles.movePendingDest}>
                  [{pendingMoveSelection.targetPosX}, {pendingMoveSelection.targetPosY}]
                </span>
                <span style={styles.movePendingIni}>
                  INI {pendingMoveSelection.ini_mod > 0 ? `+${pendingMoveSelection.ini_mod}` : pendingMoveSelection.ini_mod}
                </span>
              </div>
              <div style={styles.movePendingBtns}>
                <button className="btn" style={{ flex: 1 }} onClick={onValidateMove}>Valider</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancelPendingMove}>Changer</button>
              </div>
            </div>
          )}

          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => combatMoveMode.onCancel()}>
            Annuler le déplacement
          </button>
        </div>
      )}

      {/* Dialog durée étourdissement manuel GM */}
      {stunDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto',
        }}>
          <div style={{
            background: '#16162a', border: '2px solid #f5c542', borderRadius: 10,
            padding: '20px 24px 16px', width: 280, color: '#c0c0d0',
            fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 0 40px rgba(245,197,66,0.3)',
          }}>
            <div style={{ fontSize: 9, color: '#f5c542', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
              Durée de l&apos;étourdissement
            </div>
            <button
              className="btn btn-gold"
              style={{ width: '100%', marginBottom: 8 }}
              onClick={() => {
                const roll = Math.ceil(Math.random() * 6)
                const d = stunDialog.outcome === 'inconscient' ? roll * 10 : roll
                setStunDialogDuration(String(d))
              }}
            >
              Lancer 1D6{stunDialog.outcome === 'inconscient' ? ' × 10' : ''} tours
            </button>
            <input
              type="number" min="1" max="60"
              value={stunDialogDuration}
              onChange={e => setStunDialogDuration(e.target.value)}
              placeholder="Durée (tours)"
              style={{
                width: '100%', background: '#0e0e1e', border: '1px solid #3a3a5a',
                borderRadius: 4, color: '#e0e0f0', padding: '6px 8px', fontSize: 13,
                boxSizing: 'border-box', marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={!stunDialogDuration || isNaN(Number(stunDialogDuration)) || Number(stunDialogDuration) < 1}
                onClick={() => {
                  const d = parseInt(stunDialogDuration, 10)
                  if (!d || d < 1 || d > 60) return
                  socket.emit(WS.COMBAT_APPLY_STUN, { tokenId: stunDialog.tokenId, outcome: stunDialog.outcome, duration: d })
                  setStunDialog(null)
                }}
              >
                Confirmer
              </button>
              <button className="btn btn-ghost" onClick={() => setStunDialog(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1000,
  },
  gmResolution: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#16162a',
    border: '1px solid #f5c542',
    borderRadius: 8,
    padding: '10px 16px',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  gmResolutionLabel: {
    fontSize: 13,
    color: '#c0c0d0',
  },
  gmResolutionIni: {
    fontSize: 11,
    color: '#5b8dee',
    marginLeft: 4,
  },
  announcePanel: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 180,
    background: 'rgba(10,12,22,0.92)',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  announcePanelTitle: {
    fontSize: 8,
    color: '#456575',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  announceName: {
    fontSize: 12,
    color: '#c0c0d0',
    fontWeight: 700,
  },
  announceIni: {
    fontSize: 10,
    color: '#5b8dee',
    fontWeight: 600,
    marginLeft: 4,
  },
  announceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  announceIcon: {
    fontSize: 10,
    color: '#7070a0',
    flexShrink: 0,
  },
  announceDetail: {
    fontSize: 10,
    color: '#8888a8',
  },
  moveLegend: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 220,
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  moveLegendTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#5b5b7a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  moveLegendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 0',
  },
  moveLegendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    opacity: 0.85,
  },
  moveLegendLabel: {
    fontSize: 11,
    color: '#c0c0d0',
    flex: 1,
  },
  moveLegendDist: {
    fontSize: 10,
    color: '#7070a0',
    minWidth: 40,
    textAlign: 'right',
  },
  moveLegendIni: {
    fontSize: 10,
    color: '#5b8dee',
    minWidth: 28,
    textAlign: 'right',
    fontWeight: 600,
  },
  movePending: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #2a2a3e',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  movePendingInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movePendingDest: {
    fontSize: 12,
    color: '#5b8dee',
    fontWeight: 600,
  },
  movePendingIni: {
    fontSize: 11,
    color: '#8888a8',
  },
  movePendingBtns: {
    display: 'flex',
    gap: 6,
  },
  gmError: {
    position: 'absolute',
    top: 52,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#2a0a0a',
    border: '1px solid #c83030',
    borderRadius: 6,
    padding: '8px 14px',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
    maxWidth: 480,
  },
  gmErrorMsg: {
    fontSize: 12,
    color: '#f08080',
    flex: 1,
  },
  gmErrorClose: {
    background: 'none',
    border: 'none',
    color: '#c83030',
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
    padding: '0 2px',
  },
  losBlockedWarning: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 260,
    background: '#16162a',
    border: '2px solid #c05050',
    borderRadius: 8,
    padding: '16px 16px 14px',
    boxShadow: '0 0 40px rgba(192,80,80,0.3), 0 12px 32px rgba(0,0,0,0.7)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    zIndex: 10,
  },
  losBlockedTitle: {
    fontSize: 11,
    color: '#c05050',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  losBlockedMsg: {
    fontSize: 13,
    color: '#c0c0d0',
    lineHeight: 1.4,
  },
}
