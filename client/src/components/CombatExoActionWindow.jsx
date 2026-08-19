import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'

// PLAN_EXOARMURE.md Lot 2bis §8.5/§9 — fenêtre dédiée exo-armure, réutilisée à l'identique côté
// joueur (CombatOverlay.jsx, place de CombatActionWindow) ET côté MJ (place de CombatGmDeclareWindow)
// quand le slot d'Annonce actif est une exo-armure — même point de branchement que isGm partout
// ailleurs. Portée strictement limitée à ce Lot (§9.4) : la seule action possible pour un pilote
// d'exo est "Tenter de se relever" (state_position === 'prone', REGLEARMURE.md:381-395). Rien
// d'autre n'est câblé — pilote/Intégrité/Avaries/hardpoints arriveront aux lots suivants sur ce même
// squelette (§8.4).
export default function CombatExoActionWindow({ socket, user, characters, isGm = false }) {
  const { t } = useTranslation('combat')
  const { roster, phase, activeTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)
  const [isDeclaring, setIsDeclaring] = useState(false)

  // Le slot actif (activeTokenId) tranche quel exo afficher — jamais "le premier possédé" : côté
  // joueur comme côté MJ, CombatOverlay.jsx ne monte ce composant que si le slot actif EST déjà une
  // exo-armure (isActiveExoForPlayer / gmActiveCharacter?.type==='exo').
  const playerToken = activeTokenId ? tokens.find(tk => tk.id === activeTokenId) : null
  const playerChar  = playerToken ? characters.find(c => c.id === playerToken.character_id) : null
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null

  if (!playerToken || !playerChar || !rosterEntry) return null
  // Vérification indépendante (pas seulement confiance au montage conditionnel de CombatOverlay.jsx)
  // — même discipline que CombatActionWindow, qui filtre aussi par user_id de son côté. Le MJ n'est
  // pas forcément characters.user_id de l'exo (propriétaire brut) ni son pilote — même autorité que
  // le serveur (isExoActorAuthorized, combatantContextService.js : GM/propriétaire/pilote), le
  // serveur revalide de toute façon (core.md).
  if (!isGm && playerChar.user_id !== user?.id) return null
  if (phase !== 'ANNOUNCEMENT') return null
  if (rosterEntry.has_announced) return null
  // Seule action existant à ce Lot (§9.4) : rien à afficher hors du cas "à terre".
  if (rosterEntry.state_position !== 'prone') return null

  const handleStandUp = () => {
    if (!socket || isDeclaring) return
    setIsDeclaring(true)
    // Cible toujours 'standing' (RAW "se redresser" — pas de choix intermédiaire crouching/kneeling
    // pour ce Lot, §9.4). mapActions/quick vides : l'exclusivité de la tentative (Saar, 2026-08-18)
    // est déjà garantie côté client par le fait que cette fenêtre ne propose que ce seul bouton —
    // revérifiée côté serveur (socketCombatAnnouncement.js, autorité, jamais confiance au seul client).
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      state: { position: 'standing' },
      mapActions: {},
      quick: {},
    })
  }

  return (
    <div className="combat-float-win" style={{ minWidth: 300, maxWidth: 380, padding: '18px 22px', gap: 14 }}>
      <div className="combat-float-header" style={{ alignItems: 'baseline', borderBottom: '1px solid var(--border-session)', paddingBottom: 10, cursor: 'default' }}>
        <span>{t('exoActionWindow.title', { name: playerToken.label ?? playerChar.name })}</span>
      </div>

      <div>{t('exoActionWindow.proneHint')}</div>

      <button
        className="btn"
        style={{ width: '100%', opacity: isDeclaring ? 0.45 : 1, cursor: isDeclaring ? 'default' : 'pointer' }}
        onClick={handleStandUp}
        disabled={isDeclaring}
      >
        {isDeclaring ? t('exoActionWindow.sending') : t('exoActionWindow.standUpButton')}
      </button>
    </div>
  )
}
