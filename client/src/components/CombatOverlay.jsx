import { useState } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import CombatRosterWindow from './CombatRosterWindow'
import CombatTimeline from './CombatTimeline'
import CombatActionWindow from './CombatActionWindow'
import CombatPnjPanel from './CombatPnjPanel'
import CombatGmDeclareWindow from './CombatGmDeclareWindow'
import CombatModifiersWindow from './CombatModifiersWindow'
import CombatDamageWindow from './CombatDamageWindow'


export default function CombatOverlay({ socket, battlemap, isGm, user, characters, pendingSurpriseRoll, onSurpriseRolled, onEnterMoveMode, combatMoveMode, pendingMoveSelection, onValidateMove, onCancelPendingMove, combatTargetMode, onEnterTargetMode, onValidateTarget, damagePayload, damageResults, onDamageConfirmed, attackResult, onAttackConfirmed }) {
  const { phase, roster, activeSlotIdx, actions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [showGmPanel, setShowGmPanel] = useState(false)

  // Slot actif en RÉSOLUTION — pour le panneau GM
  const sortedRoster = [...roster].sort((a, b) => b.initiative - a.initiative)
  const gmActiveEntry = sortedRoster[activeSlotIdx]
  const gmActiveToken = gmActiveEntry ? tokens.find(t => t.id === gmActiveEntry.token_id) : null
  const gmActiveCharacter = gmActiveToken ? characters.find(c => c.id === gmActiveToken.character_id) : null
  const activeAssaultAction = gmActiveEntry
    ? actions.find(a => a.token_id === gmActiveEntry.token_id && a.action_key === 'assault')
    : null

  // Slot actif PJ — fenêtre modificateurs côté joueur
  const playerCharacter = !isGm ? characters.find(c => c.user_id === user?.id) : null
  const playerToken = playerCharacter ? tokens.find(t => t.character_id === playerCharacter.id) : null
  const playerRosterEntry = playerToken ? sortedRoster.find(e => e.token_id === playerToken.id) : null
  const playerActiveAssaultAction = (phase === 'RESOLUTION' && sortedRoster[activeSlotIdx]?.token_id === playerToken?.id)
    ? actions.find(a => a.token_id === playerToken?.id && a.action_key === 'assault')
    : null

  return (
    <div style={styles.overlay}>

      {/* Timeline — visible à tous dès que le combat est actif */}
      {phase && (
        <CombatTimeline
          characters={characters}
          topOffset={isGm ? 40 : 0}
          onPortraitClick={isGm && phase === 'ANNOUNCEMENT' ? () => setShowGmPanel(p => !p) : undefined}
        />
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
        />
      )}

      {/* ANNOUNCEMENT + RÉSOLUTION — fenêtre d'action pour les joueurs
          Masquée pendant la résolution d'un assaut PJ (CombatModifiersWindow prend le relais) */}
      {!isGm && (phase === 'ANNOUNCEMENT' || (phase === 'RESOLUTION' && !playerActiveAssaultAction && !attackResult)) && (
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

      {/* Phase RÉSOLUTION — panneau GM : confirmer le slot actif (hors assaut) */}
      {isGm && phase === 'RESOLUTION' && gmActiveEntry && !activeAssaultAction && (
        <div style={styles.gmResolution}>
          <div style={styles.gmResolutionLabel}>
            Slot actif : <strong>{gmActiveToken?.label ?? '?'}</strong>
            <span style={styles.gmResolutionIni}> INI {gmActiveEntry.initiative}</span>
          </div>
          <button
            style={styles.gmResolutionBtn}
            onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: gmActiveEntry.token_id })}
          >
            Agir
          </button>
        </div>
      )}

      {/* Phase RÉSOLUTION — modificateurs assaut PJ (joueur résout lui-même) */}
      {!isGm && phase === 'RESOLUTION' && (playerActiveAssaultAction || attackResult) && (
        <CombatModifiersWindow
          socket={socket}
          assaultAction={playerActiveAssaultAction}
          activeRosterEntry={playerRosterEntry}
          attackResult={attackResult}
          onAttackConfirmed={onAttackConfirmed}
        />
      )}

      {/* Phase RÉSOLUTION — modificateurs assaut PNJ (GM uniquement, PNJ seulement) */}
      {isGm && phase === 'RESOLUTION' && activeAssaultAction && gmActiveEntry && gmActiveCharacter?.type === 'pnj' && (
        <CombatModifiersWindow
          socket={socket}
          assaultAction={activeAssaultAction}
          activeRosterEntry={gmActiveEntry}
        />
      )}

      {/* Panneau visée assaut — visible pendant le mode sélection cible */}
      {combatTargetMode && (
        <div style={styles.moveLegend}>
          <div style={styles.moveLegendTitle}>Assaut — Cliquez sur la cible</div>

          {combatTargetMode.pendingTargetId && (() => {
            const tgt = tokens.find(t => t.id === combatTargetMode.pendingTargetId)
            return (
              <div style={styles.movePending}>
                <div style={styles.movePendingInfo}>
                  <span style={styles.movePendingDest}>{tgt?.label ?? '?'}</span>
                </div>
                <div style={styles.movePendingBtns}>
                  <button style={styles.btnValider} onClick={onValidateTarget}>Valider</button>
                  <button style={styles.btnChanger} onClick={() => combatTargetMode.onPendingTarget(null)}>Changer</button>
                </div>
              </div>
            )
          })()}

          <button style={styles.btnAnnulerMode} onClick={() => combatTargetMode.onCancel()}>
            Annuler la visée
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

      {/* Panneau légende déplacement — visible pendant le mode sélection destination */}
      {combatMoveMode && (
        <div style={styles.moveLegend}>
          <div style={styles.moveLegendTitle}>Déplacement</div>

          {combatMoveMode.zones.map((zone, i) => {
            const iniStr = zone.ini_mod > 0 ? `+${zone.ini_mod}` : zone.ini_mod === 0 ? '±0' : `${zone.ini_mod}`
            return (
              <div key={zone.action_key + i} style={styles.moveLegendRow}>
                <span style={{ ...styles.moveLegendDot, background: zone.color }} />
                <span style={styles.moveLegendLabel}>{zone.label}</span>
                <span style={styles.moveLegendDist}>≤ {zone.radius} m</span>
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
                <button style={styles.btnValider} onClick={onValidateMove}>Valider</button>
                <button style={styles.btnChanger} onClick={onCancelPendingMove}>Changer</button>
              </div>
            </div>
          )}

          <button style={styles.btnAnnulerMode} onClick={() => combatMoveMode.onCancel()}>
            Annuler le déplacement
          </button>
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
  gmResolutionBtn: {
    padding: '6px 18px',
    background: 'rgba(245,197,66,0.15)',
    border: '1px solid #f5c542',
    borderRadius: 4,
    color: '#f5c542',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
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
  btnValider: {
    flex: 1,
    padding: '6px 0',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: 4,
    color: '#5b8dee',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnChanger: {
    flex: 1,
    padding: '6px 0',
    background: 'none',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 12,
    cursor: 'pointer',
  },
  btnAnnulerMode: {
    marginTop: 8,
    padding: '6px 0',
    background: 'none',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#5a5a7a',
    fontSize: 11,
    cursor: 'pointer',
    width: '100%',
  },
}
