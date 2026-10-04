import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDraggable } from '../lib/useDraggable.js'

// Fenêtre de confirmation d'allocation d'XP (CHARSHEET-XP-SPEND-CONFIRM) — même patron que
// WoundReviewWindow.jsx (Palette A, createPortal dans <body> pour échapper l'overflow de
// CharacterWindow). SkillsPanel.jsx reste l'unique source de vérité de la file en attente ; ce
// composant ne fait qu'afficher et déléguer les 3 actions (retrait d'une ligne, Valider, Annuler).
const PANEL_W = 320

export default function SkillPurchaseConfirmWindow({
  pending, totalCost, xpRemaining, validating, error, onRemove, onValidate, onCancel,
}) {
  const { t } = useTranslation()
  const { pos, onHeaderMouseDown } = useDraggable(
    'skill-purchase-confirm-pos',
    { top: 80, left: Math.max(8, window.innerWidth / 2 - PANEL_W / 2) },
    PANEL_W,
  )

  if (pending.length === 0) return null

  return createPortal(
    <div
      className="combat-win skill-purchase-confirm-win"
      style={{ width: PANEL_W, left: pos.left, top: pos.top }}
      role="dialog"
      aria-label={t('skillsPanel.confirmWindow.title')}
    >
      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <span className="combat-win-title">{t('skillsPanel.confirmWindow.title')}</span>
      </div>

      <div style={S.body}>
        {pending.map(entry => (
          <div key={entry.localId} style={S.row}>
            <span style={S.rowLabel}>
              {entry.kind === 'unlock'
                ? t('skillsPanel.confirmWindow.lineUnlock', { skill: entry.skillLabel, cost: entry.cost })
                : t('skillsPanel.confirmWindow.lineIncrement', { skill: entry.skillLabel, mastery: entry.resultMastery, cost: entry.cost })}
            </span>
            <button
              type="button"
              className="btn-icon"
              disabled={validating}
              onClick={() => onRemove(entry.localId)}
              title={t('skillsPanel.confirmWindow.remove')}
              aria-label={t('skillsPanel.confirmWindow.remove')}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {error && <div style={S.error} role="alert">{error}</div>}

      <div className="combat-win-footer">
        <div style={S.totals}>
          <span>{t('skillsPanel.confirmWindow.totalCost', { count: totalCost })}</span>
          <span>{t('skillsPanel.confirmWindow.xpRemaining', { count: xpRemaining })}</span>
        </div>
        <div style={S.actions}>
          <button type="button" className="btn btn-ghost" disabled={validating} onClick={onCancel}>
            {t('skillsPanel.confirmWindow.cancel')}
          </button>
          <button type="button" className="btn btn-success" disabled={validating} onClick={onValidate}>
            {validating ? t('skillsPanel.confirmWindow.validating') : t('skillsPanel.confirmWindow.validate')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const S = {
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    maxHeight: 240,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    fontSize: 11,
    color: '#c0c0d0',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  error: {
    padding: '6px 12px',
    fontSize: 10,
    color: '#f0c4c4',
    background: 'rgba(224,91,91,0.1)',
    borderTop: '1px solid rgba(224,91,91,0.3)',
  },
  totals: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 10,
    color: '#8888a8',
  },
  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
}
