import { useTranslation } from 'react-i18next'
import { getAgeEffects } from '../../../../shared/polarisUtils.js'

export default function AgeSelector({ age, onChange, attributes, youngPenaltyEnabled, onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const effects = getAgeEffects(age, { attributes, youngPenaltyEnabled })
  const effectEntries = Object.entries(effects)

  const handleSliderChange = (e) => {
    onChange(parseInt(e.target.value, 10))
  }

  const formatEffects = () => {
    if (effectEntries.length === 0) return t('step4.age_effects_none')
    const list = effectEntries.map(([attr, malus]) => `${attr} ${malus}`).join(', ')
    return t('step4.age_effects_desc', { effects: list })
  }

  return (
    <div style={s.container}>
      <h2 style={s.title}>{t('step4.age_label')}</h2>

      <div style={s.sliderGroup}>
        <span style={s.ageValue}>{t('step4.age_slider', { age })}</span>
        <input
          type="range"
          min={16}
          max={60}
          value={age}
          onChange={handleSliderChange}
          style={s.slider}
        />
        <div style={s.sliderLabels}>
          <span style={s.sliderLabel}>16</span>
          <span style={s.sliderLabel}>60</span>
        </div>
      </div>

      <div style={s.effectsBox}>
        <h3 style={s.effectsTitle}>{t('step4.age_effects')}</h3>
        <p style={s.effectsDesc}>{formatEffects()}</p>
      </div>

      <div style={s.nav}>
        <button style={s.backBtn} onClick={onPrev}>
          {t('step4.prev')}
        </button>
        <button style={s.nextBtn} onClick={onNext}>
          {t('step4.next')}
        </button>
      </div>
    </div>
  )
}

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    gap: '32px',
  },
  title: {
    color: '#c8c8f0',
    fontSize: '24px',
    fontWeight: '700',
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    maxWidth: '400px',
  },
  ageValue: {
    color: '#e0a85c',
    fontSize: '28px',
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: '6px',
    cursor: 'pointer',
    accentColor: '#5b8dee',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
  },
  sliderLabel: {
    color: '#5a5a7a',
    fontSize: '11px',
  },
  effectsBox: {
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '16px 24px',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  effectsTitle: {
    color: '#9090c8',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  effectsDesc: {
    color: '#c0a060',
    fontSize: '14px',
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '16px',
    marginTop: '16px',
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8080a0',
    cursor: 'pointer',
    fontSize: '13px',
  },
  nextBtn: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#5b8dee',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}