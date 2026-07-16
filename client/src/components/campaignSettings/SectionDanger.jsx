// client/src/components/campaignSettings/SectionDanger.jsx
// Suppression définitive de la campagne — déplacé depuis DashboardPage.jsx (PLAN_FUSION.md
// Lot 8.A, Session 142) où le bouton était mal positionné (derrière les cartes, non cliquable
// sur le serveur distant). Même logique, même confirmation, même clés i18n qu'avant.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { sharedStyles as styles } from './sharedStyles'

export default function SectionDanger({ campaignId, campaignName }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/campaigns/${campaignId}`)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error?.message || t('settings.deleteCampaignError'))
      setDeleting(false)
    }
  }

  return (
    <section className="card" style={{ border: '1px solid rgba(239,68,68,0.45)' }}>
      <h2 style={{ ...styles.sectionTitle, color: 'var(--color-danger)' }}>{t('settings.deleteCampaignTitle')}</h2>

      <div style={warningStyle} role="alert">
        <strong>{t('settings.deleteCampaignWarningTitle')}</strong>
        <p>{t('settings.deleteCampaignWarning', { name: campaignName })}</p>
      </div>

      {error && <p style={{ ...styles.placeholderText, color: 'var(--color-danger)' }}>{error}</p>}

      <button
        className="btn btn-danger"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? t('settings.deletingCampaign') : t('settings.confirmDeleteCampaign')}
      </button>
    </section>
  )
}

const warningStyle = {
  margin: '0 0 18px',
  padding: '14px 16px',
  border: '1px solid rgba(239,68,68,0.42)',
  borderRadius: '8px',
  backgroundColor: 'rgba(127,29,29,0.16)',
  color: 'var(--text-primary)',
  lineHeight: 1.45,
}
