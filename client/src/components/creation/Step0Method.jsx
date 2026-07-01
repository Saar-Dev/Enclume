import { useTranslation } from 'react-i18next'

const ASSETS_BASE = `${import.meta.env.VITE_API_URL}/api/assets/assets`

export default function Step0Method({ onNext }) {
  const { t } = useTranslation('creation')

  return (
    <div className="wiz-page">
      <div
        className="wiz-bg-image"
        style={{ backgroundImage: `url('${ASSETS_BASE}/bg.jpg')` }}
      />

      <div className="wiz-container">
        <h1 className="wiz-title">{t('method.title')}</h1>
        <p className="wiz-subtitle">{t('method.subtitle')}</p>
        <div className="wiz-divider" />

        <div className="wiz-cards">
          <div className="wiz-card wiz-card-disabled">
            <div className="wiz-card-media">
              <img className="wiz-card-img" src={`${ASSETS_BASE}/PolarisCharacter01.jpg`} alt="" />
              <div className="wiz-card-media-fade" />
            </div>
            <div className="wiz-card-body">
              <span className="wiz-card-eyebrow">{t('method.1.eyebrow')}</span>
              <h2 className="wiz-card-title">{t('method.1.name')}</h2>
              <p className="wiz-card-desc">{t('method.1.desc')}</p>
              <span className="wiz-badge-soon">{t('method.1.comingsoon')}</span>
            </div>
          </div>

          <div className="wiz-card wiz-card-active" onClick={onNext}>
            <div className="wiz-card-media">
              <img className="wiz-card-img" src={`${ASSETS_BASE}/PolarisCharacter02.jpg`} alt="" />
              <div className="wiz-card-media-fade" />
            </div>
            <div className="wiz-card-body">
              <span className="wiz-card-eyebrow">{t('method.2.eyebrow')}</span>
              <h2 className="wiz-card-title">{t('method.2.name')}</h2>
              <p className="wiz-card-desc">{t('method.2.desc')}</p>
              <button className="wiz-btn-start">{t('method.2.start')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
