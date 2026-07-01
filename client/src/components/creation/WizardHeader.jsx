import { useTranslation } from 'react-i18next'

export default function WizardHeader({ step, totalSteps, pcDispo, infos, onStepClick }) {
  const { t } = useTranslation('creation')

  return (
    <div className="wiz-header-bar">
      <div className="wiz-header-row">

        <div className="wiz-stepper">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).flatMap((n) => {
            const state = n < step ? 'done' : n === step ? 'active' : 'future'
            const clickable = state === 'done'
            const nodes = []
            if (n > 1) {
              nodes.push(
                <div
                  key={`line-${n}`}
                  className={`wiz-stepper-line wiz-stepper-line--${n <= step ? 'done' : 'future'}`}
                />
              )
            }
            nodes.push(
              <div
                key={`step-${n}`}
                className={`wiz-stepper-item wiz-stepper-item--${state}`}
                onClick={clickable ? () => onStepClick?.(n) : undefined}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
              >
                <div className={`wiz-stepper-dot wiz-stepper-dot--${state}`}>{n}</div>
                <span className="wiz-stepper-label">{t(`wizard.step_label_${n}`)}</span>
              </div>
            )
            return nodes
          })}
        </div>

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
