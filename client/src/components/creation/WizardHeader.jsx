// client/src/components/creation/WizardHeader.jsx
import { useTranslation } from 'react-i18next'

export default function WizardHeader({ step, totalSteps, pcDispo, infos }) {
  const { t } = useTranslation('creation')

  return (
    <div style={s.bar}>
      <div style={s.row1}>
        <span style={s.stepTitle}>
          {t('wizard.step', { current: step, total: totalSteps })}
        </span>
        <div style={s.pcBlock}>
          <span style={s.pcLabel}>{t('wizard.pc_label')}</span>
          <span style={s.pcValue}>{pcDispo}</span>
        </div>
      </div>
      {infos && (
        <div style={s.row2}>
          {infos}
        </div>
      )}
    </div>
  )
}

const s = {
  bar: {
    backgroundColor: '#0a0a18',
    borderBottom: '1px solid #1e1e2e',
    padding: '10px 20px 8px',
    flexShrink: 0,
  },
  row1: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    color: '#9090c8',
    fontSize: '13px',
    fontWeight: '600',
  },
  pcBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  pcLabel: {
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  pcValue: {
    color: '#e0a85c',
    fontSize: '22px',
    fontWeight: '700',
    lineHeight: '1',
  },
  row2: {
    display: 'flex',
    gap: '10px',
    marginTop: '6px',
    flexWrap: 'wrap',
  },
}