import { useTranslation } from 'react-i18next'

// Icône cadenas MJ (docs/PLAN_WIZARDCOLLAB.md Lot A2) — rendue par l'appelant uniquement quand
// useWizardLock().showLockToggle est vrai. stopPropagation : ne doit jamais déclencher le clic de
// sélection normal de la carte/ligne qui l'englobe.
export default function WizardLockToggle({ locked, onToggle }) {
  const { t } = useTranslation('creation')
  return (
    <button
      type="button"
      className="btn-icon"
      data-active={locked}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      title={t(locked ? 'wizard.unlock_option' : 'wizard.lock_option')}
    >
      {locked ? '🔒' : '🔓'}
    </button>
  )
}
