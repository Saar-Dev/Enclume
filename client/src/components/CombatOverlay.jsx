import { useState } from 'react'
import { useCombatStore } from '../stores/combatStore'
import CombatRosterWindow from './CombatRosterWindow'
import CombatTimeline from './CombatTimeline'
import CombatActionWindow from './CombatActionWindow'
import CombatPnjPanel from './CombatPnjPanel'
import CombatGmDeclareWindow from './CombatGmDeclareWindow'

export default function CombatOverlay({ socket, battlemap, isGm, user, characters, pendingSurpriseRoll, onSurpriseRolled }) {
  const phase = useCombatStore(s => s.phase)
  const [showGmPanel, setShowGmPanel] = useState(false)

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

      {/* Phase ANNOUNCEMENT — fenêtre d'action pour les joueurs */}
      {!isGm && phase === 'ANNOUNCEMENT' && (
        <CombatActionWindow
          socket={socket}
          user={user}
          characters={characters}
          pendingSurpriseRoll={pendingSurpriseRoll}
          onSurpriseRolled={onSurpriseRolled}
        />
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
}
