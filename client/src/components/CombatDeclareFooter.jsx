import { useTranslation } from 'react-i18next'
import CombatDeclareIniWidget from './CombatDeclareIniWidget.jsx'

// Pied unifié des fenêtres de déclaration de combat (PLAN_RW_DECLARE_DESIGN module 5, D12).
// Rangée : [pastille INI] [message de statut centré] [Passer le tour (ghost)] [Déclarer (primaire)].
//
// Présentationnel pur : la fenêtre calcule tout — `canDeclare` / `hasCompleteAction` via
// `declareChecks.js`, `blockReason` via `buildBlockReason`. Le composant ne compose que le message
// de statut (il a `t`).
//
// Ordre B (§5.0) : monté DANS le pied actuel (`.combat-float-footer` / `.combat-win-footer`)
// jusqu'au module 2, où il passera dans le slot `footer` du `CombatDeclareFrame`. L'erreur d'allures
// drone et `<CombatDeclareErrorBanner>` restent rendus par la fenêtre, au-dessus.
//
// « Passer le tour » est **toujours cliquable** (D12 littéral — PO-M5-f rejeté) : envoie une
// déclaration vide, jette une éventuelle demi-config. « Déclarer » actif ⟺ `hasCompleteAction &&
// canDeclare`, sinon grisé + `blockReason` au centre.
export default function CombatDeclareFooter({
  currentInitiative,
  iniDelta = 0,
  iniBreakdown = [],
  hasCompleteAction,
  canDeclare,
  blockReason = null,
  moveDestination = null,   // { x, y } | null
  hasActiveSlot = true,
  onDeclare,
  onPassTurn,
}) {
  const { t } = useTranslation('combat')

  const status = blockReason
    ?? (!hasCompleteAction
      ? null
      : moveDestination
        ? t('declareFooter.statusDestination', { x: moveDestination.x, y: moveDestination.y })
        : t('declareFooter.statusReady'))

  return (
    <div className="combat-declare-footer">
      <CombatDeclareIniWidget
        currentInitiative={currentInitiative}
        delta={iniDelta}
        breakdown={iniBreakdown}
      />
      <span className="combat-declare-status">{status}</span>
      <button
        type="button"
        className="btn-tac-ghost"
        onClick={onPassTurn}
        disabled={!hasActiveSlot}
      >
        {t('declareFooter.passTurn')}
      </button>
      <button
        type="button"
        className="btn-tac"
        style={{ flex: 1 }}
        onClick={onDeclare}
        disabled={!(hasActiveSlot && hasCompleteAction && canDeclare)}
      >
        {t('actionWindow.declareActionButton')}
      </button>
    </div>
  )
}
