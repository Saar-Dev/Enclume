import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Fenêtre de confirmation avant de finaliser une création qui garde des Points de Création
// non dépensés. Ne décide rien : WizardCreation.jsx (qui connaît pcDispo et lance la
// finalisation) l'ouvre et lui passe les deux actions.
export default function WizardFinalizeConfirm({ pcRemaining, busy, onConfirm, onCancel }) {
  const { t } = useTranslation('creation')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="wiz-confirm-overlay" onClick={() => { if (!busy) onCancel() }}>
      <div
        className="wiz-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wiz-confirm-title"
        onClick={e => e.stopPropagation()}
      >
        <div id="wiz-confirm-title" className="wiz-confirm-title">
          {t('wizard.finalize_pc_remaining_title')}
        </div>
        <p className="wiz-confirm-text">
          {t('wizard.finalize_pc_remaining_text', { n: pcRemaining })}
        </p>
        <div className="wiz-confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy} autoFocus>
            {t('wizard.finalize_pc_remaining_back')}
          </button>
          <button className="btn btn-gold" onClick={onConfirm} disabled={busy}>
            {busy ? '…' : t('wizard.finalize_pc_remaining_anyway')}
          </button>
        </div>
      </div>
    </div>
  )
}
