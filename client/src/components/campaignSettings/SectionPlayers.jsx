// client/src/components/campaignSettings/SectionPlayers.jsx
import { useTranslation } from 'react-i18next'
import { sharedStyles as styles } from './sharedStyles'

export default function SectionPlayers() {
  const { t } = useTranslation()
  return (
    <section style={{ ...styles.section, opacity: 0.5 }}>
      <h2 style={styles.sectionTitle}>{t('settings.sectionPlayers')}</h2>
      <p style={styles.placeholderText}>{t('settings.sectionPlayersPlaceholder')}</p>
    </section>
  )
}