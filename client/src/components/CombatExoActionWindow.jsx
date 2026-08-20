import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'

// PLAN_EXOARMURE.md Lot 2bis §8.5/§9 — fenêtre dédiée exo-armure, réutilisée à l'identique côté
// joueur (CombatOverlay.jsx, place de CombatActionWindow) ET côté MJ (place de CombatGmDeclareWindow)
// quand le slot d'Annonce actif est une exo-armure — même point de branchement que isGm partout
// ailleurs. Portée volontairement étroite (§9.4) : "Tenter de se relever" (state_position ===
// 'prone', REGLEARMURE.md:381-395) reste la seule action RÉELLE câblée — armement/hardpoints
// arriveront au Lot C (§13.4). Mais sans repli, une exo-armure debout n'avait STRICTEMENT AUCUN
// moyen de déclarer quoi que ce soit (fenêtre ne rendait rien) — la Phase Annonce ne pouvait jamais
// avancer, bloquant tout test de combat réel (trouvé par Saar, 2026-08-20). "Passer le tour" ajouté
// pour ce cas : `state: {}` laisse `combat_roster.state_*` inchangés côté serveur
// (socketCombatAnnouncement.js:641-652, chaque champ retombe sur `entry.state_*` si absent du
// payload) tout en posant `has_announced: true` — même mécanique que le bouton "Passer" déjà en
// place pour le drone (useDroneDeclare.js#hasPassed), pas un nouveau chemin serveur.
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

  const isProne = rosterEntry.state_position === 'prone'

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

  // "Passer le tour" — état vide : socketCombatAnnouncement.js laisse chaque state_* inchangé quand
  // le payload ne le fournit pas, pose has_announced:true (même mécanisme que useDroneDeclare#hasPassed,
  // pas un chemin serveur nouveau). Disponible dans les deux cas (debout ET à terre) — à terre, c'est
  // l'alternative à "Tenter de se relever" quand le joueur préfère ne pas risquer l'échec ce Tour.
  const handlePass = () => {
    if (!socket || isDeclaring) return
    setIsDeclaring(true)
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      state: {},
      mapActions: {},
      quick: {},
    })
  }

  return (
    <div className="combat-float-win" style={{ minWidth: 300, maxWidth: 380, padding: '18px 22px', gap: 14 }}>
      <div className="combat-float-header" style={{ alignItems: 'baseline', borderBottom: '1px solid var(--border-session)', paddingBottom: 10, cursor: 'default' }}>
        <span>{t('exoActionWindow.title', { name: playerToken.label ?? playerChar.name })}</span>
      </div>

      <div>{isProne ? t('exoActionWindow.proneHint') : t('exoActionWindow.normalHint')}</div>

      {isProne && (
        <button
          className="btn"
          style={{ width: '100%', opacity: isDeclaring ? 0.45 : 1, cursor: isDeclaring ? 'default' : 'pointer' }}
          onClick={handleStandUp}
          disabled={isDeclaring}
        >
          {isDeclaring ? t('exoActionWindow.sending') : t('exoActionWindow.standUpButton')}
        </button>
      )}

      <button
        className="btn btn-ghost"
        style={{ width: '100%', opacity: isDeclaring ? 0.45 : 1, cursor: isDeclaring ? 'default' : 'pointer' }}
        onClick={handlePass}
        disabled={isDeclaring}
      >
        {isDeclaring ? t('exoActionWindow.sending') : t('exoActionWindow.passTurnButton')}
      </button>
    </div>
  )
}
