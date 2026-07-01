import { useTranslation } from 'react-i18next'

export default function WizardHeader({ step, totalSteps, pcDispo, infos }) {
  const { t } = useTranslation('creation')

  return (
    <div className="wiz-header-bar">
      <div className="wiz-header-row">
        <span className="wiz-header-step">
          {t('wizard.step', { current: step, total: totalSteps })}
        </span>
        <div className="wiz-header-pc-block">
          <span className="wiz-header-pc-label">{t('wizard.pc_label')}</span>
          <span className="wiz-header-pc-value">{pcDispo}</span>
        </div>
      </div>
      {infos && (
        <div className="wiz-header-row2">
          {infos}
        </div>
      )}
    </div>
  )
}
