import { useTranslation } from 'react-i18next'

export default function WizardHeader({
  step, totalSteps, highestStep = 0, pcDispo, infos, onStepClick, hasCharacter = false, onOpenPeek, peekLoading = false,
  isGmView = false, guideModeActive = false, onToggleGuideMode,
}) {
  const { t } = useTranslation('creation')

  return (
    <div className="wiz-header-bar">
      <div className="wiz-header-row">

        <div className="wiz-stepper">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).flatMap((n) => {
            const state = n < step ? 'done' : n === step ? 'active' : n <= highestStep ? 'reachable' : 'future'
            const clickable = state === 'done' || state === 'reachable'
            const nodes = []
            if (n > 1) {
              nodes.push(
                <div
                  key={`line-${n}`}
                  className={`wiz-stepper-line wiz-stepper-line--${n <= step ? 'done' : n <= highestStep ? 'reachable' : 'future'}`}
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

        <button
          className="btn btn-ghost"
          onClick={onOpenPeek}
          disabled={!hasCharacter || peekLoading}
        >
          {peekLoading ? '…' : t('wizard.open_sheet')}
        </button>

        {isGmView && (
          <button
            className="btn-toggle"
            data-active={guideModeActive}
            onClick={onToggleGuideMode}
            style={{ flex: '0 0 auto', padding: '8px 14px' }}
          >
            {t('wizard.guide_mode')}
          </button>
        )}

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
