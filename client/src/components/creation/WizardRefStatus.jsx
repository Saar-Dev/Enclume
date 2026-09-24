import { useTranslation } from 'react-i18next'

// État d'attente/échec du chargement des données de référence d'une étape (useWizardRef). `refs` :
// les résultats de useWizardRef dont l'étape dépend. À afficher à la place du contenu tant que
// wizardRefsPending(refs) est vrai : les sous-composants ne doivent PAS être montés sur un catalogue
// vide (cf. PRUNE_ALLOCATIONS de CareersAllocator).
export default function WizardRefStatus({ refs }) {
  const { t } = useTranslation('creation')
  const failed = refs.filter(r => r.failed)

  if (failed.length > 0) {
    return (
      <div className="wiz-ref-status">
        <div className="wiz-error">{t('wizard.ref_error')}</div>
        <button className="btn btn-ghost" onClick={() => failed.forEach(r => r.retry())}>
          {t('wizard.ref_retry')}
        </button>
      </div>
    )
  }
  return (
    <div className="wiz-ref-status">
      <p className="wiz-ref-status-text">{t('wizard.ref_loading')}</p>
    </div>
  )
}
