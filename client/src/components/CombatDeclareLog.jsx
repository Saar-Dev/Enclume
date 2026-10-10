import { useTranslation } from 'react-i18next'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import { ACTION_LABELS, PURE_MOVE_TYPES } from './combatSections.js'

function EntryLines({ entry, tokens }) {
  const { t } = useTranslation('combat')
  const tok    = tokens.find(tk => tk.id === entry.tokenId)
  const atkTok = entry.attackTargetId ? tokens.find(tk => tk.id === entry.attackTargetId) : null
  const isPureMove     = PURE_MOVE_TYPES.has(entry.actionType)
  const hasSeparateMove = entry.moveTarget && !isPureMove

  const actionLabelKey = ACTION_LABELS[entry.actionType]
  const actionLabel = actionLabelKey ? t(actionLabelKey) : (entry.actionType ?? '–')
  // Distance plutôt que coordonnées brutes (retour Saar, COMBAT-GM-RECAP-WINDOW-MISMATCH) — même
  // notion de distance que le reste du combat (coût de déplacement pondéré par le terrain, pas une
  // mesure géométrique pure, cf. commentaire serveur socketCombatAnnouncement.js).
  const moveDest = Number.isFinite(entry.distanceM) ? `(${entry.distanceM.toFixed(1)}m)` : null
  const weaponOrSkillLabel = entry.weaponLabel ?? (entry.meleeBareHands ? t('meleeCombatPanel.bareHands') : null)
  // Distance à la cible gardée même sans nom d'arme (drone/exo, hors périmètre pour le nom — voir
  // socketCombatAnnouncement.js) : la distance, elle, ne dépend pas du type de tireur.
  const attackMetaParts = [weaponOrSkillLabel, Number.isFinite(entry.attackDistanceM) ? `${entry.attackDistanceM.toFixed(1)}m` : null].filter(Boolean)
  const attackMetaLabel = attackMetaParts.length > 0 ? ` (${attackMetaParts.join(', ')})` : ''

  return (
    <>
      {/* Header acteur */}
      <div className="combat-declare-log-actor">
        <span
          className="combat-declare-log-dot"
          style={{ background: tok?.color ?? '#5b8dee' }}
        />
        <span className="combat-declare-log-name">{tok?.label ?? '?'}</span>
        <span className="combat-declare-log-ini">INI {entry.initiative ?? '?'}</span>
      </div>

      {/* Ligne déplacement (si combiné avec une autre action) */}
      {hasSeparateMove && (
        <div className="combat-declare-log-line">
          <span className="combat-declare-log-icon">→</span>
          <span className="combat-declare-log-detail combat-declare-log-detail--move">
            {t('actionLabels.move')} {moveDest}
          </span>
        </div>
      )}

      {/* Ligne action principale */}
      <div className="combat-declare-log-line">
        <span className="combat-declare-log-icon">
          {(entry.actionType === 'assault' || entry.actionType === 'melee') ? '⚡'
            : isPureMove ? '→'
            : entry.actionType === 'reload' ? '↺'
            : '◆'}
        </span>
        <span className={
          'combat-declare-log-detail' +
          (entry.actionType === 'assault' ? ' combat-declare-log-detail--atk' : '') +
          (entry.actionType === 'melee'   ? ' combat-declare-log-detail--melee' : '') +
          (isPureMove                     ? ' combat-declare-log-detail--move' : '')
        }>
          {actionLabel}
          {isPureMove && moveDest ? ` ${moveDest}` : ''}
          {attackMetaLabel}
          {atkTok ? ` → ${atkTok.label}` : ''}
        </span>
      </div>
    </>
  )
}

// Corps du log uniquement — pas de titre. Chaque parent gère son titre.
export function DeclareLogContent({ maxHeight }) {
  const { t } = useTranslation('combat')
  const { announcedActions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  return (
    <div className="combat-declare-log-body" style={maxHeight ? { maxHeight } : undefined}>
      {announcedActions.length === 0 ? (
        <div className="combat-declare-log-empty">{t('declareLog.empty')}</div>
      ) : (
        announcedActions.map((entry, i) => (
          <EntryLines key={`${entry.tokenId}-${i}`} entry={entry} tokens={tokens} />
        ))
      )}
    </div>
  )
}

// Panneau intégré au tab chat de Sidebar.jsx — contrôlé (isOpen/onToggle) : l'état plié/déplié
// appartient au parent, qui ne démonte/remonte ce composant qu'au changement de phase (ANNONCE/
// RÉSOLUTION) — un state interne ici perdrait le choix de l'utilisateur à chaque transition.
export function CombatDeclareLogChatPanel({ isOpen, onToggle }) {
  const { t } = useTranslation('combat')
  const { currentTurn } = useCombatStore()

  return (
    <div className="cdl-chat">
      <div className="cdl-chat-header" onClick={onToggle}>
        <span>{t('declareLog.title', { turn: currentTurn })}</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && (
        <div className="cdl-chat-body">
          <DeclareLogContent />
        </div>
      )}
    </div>
  )
}
