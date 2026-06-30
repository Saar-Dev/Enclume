import { useTranslation } from 'react-i18next'

const BG_URL = 'http://localhost:9000/enclume-assets/assets/PolarisCharacter01.jpg'

export default function Step0Method({ onNext }) {
  const { t } = useTranslation('creation')

  return (
    <div style={s.background}>
    <div style={s.container}>
      <h1 style={s.title}>{t('method.title')}</h1>
      <p style={s.subtitle}>{t('method.subtitle')}</p>

      <div style={s.cards}>
        <div style={{ ...s.card, ...s.cardDisabled }}>
          <div style={s.cardIllustration}>🧬</div>
          <h2 style={s.cardTitle}>{t('method.1.name')}</h2>
          <p style={s.cardDesc}>{t('method.1.desc')}</p>
          <span style={s.badge}>{t('method.1.comingsoon')}</span>
        </div>

        <div style={{ ...s.card, ...s.cardActive }} onClick={onNext}>
          <div style={s.cardIllustration}>🎯</div>
          <h2 style={s.cardTitle}>{t('method.2.name')}</h2>
          <p style={s.cardDesc}>{t('method.2.desc')}</p>
          <button style={s.startBtn}>{t('method.2.start')}</button>
        </div>
      </div>
    </div>
    </div>
  )
}

const s = {
  background: {
    minHeight: '100vh',
    backgroundImage: `url('${BG_URL}')`,
    backgroundPosition: 'center bottom',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'auto 40%',
    backgroundColor: '#06060e',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    minHeight: '100%',
  },
  title: {
    color: '#c0c0d0',
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '8px',
    textAlign: 'center',
  },
  subtitle: {
    color: '#5a5a7a',
    fontSize: '12px',
    marginBottom: '40px',
    textAlign: 'center',
    maxWidth: '500px',
    lineHeight: '1.6',
  },
  cards: {
    display: 'flex',
    gap: '24px',
    maxWidth: '800px',
    width: '100%',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    maxWidth: '360px',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    transition: 'all 0.2s ease',
    backgroundColor: 'rgba(6,6,14,0.85)',
  },
  cardDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  cardActive: {
    cursor: 'pointer',
    borderColor: '#3a3a5e',
  },
  cardIllustration: {
    fontSize: '40px',
    marginBottom: '16px',
  },
  cardTitle: {
    color: '#c0c0d0',
    fontSize: '15px',
    fontWeight: '700',
    marginBottom: '12px',
  },
  cardDesc: {
    color: '#6a6a8a',
    fontSize: '11px',
    lineHeight: '1.7',
    marginBottom: '20px',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  startBtn: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#5b8dee',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
}