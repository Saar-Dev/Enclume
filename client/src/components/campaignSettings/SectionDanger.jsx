// client/src/components/campaignSettings/SectionDanger.jsx
// Suppression définitive de la campagne — déplacé depuis DashboardPage.jsx (PLAN_FUSION.md
// Lot 8.A, Session 142) où le bouton était mal positionné (derrière les cartes, non cliquable
// sur le serveur distant). Même logique, même confirmation, même clés i18n qu'avant.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

export default function SectionDanger({ campaignId, campaignName }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    const confirmed = window.confirm(t('settings.deleteCampaignConfirm', { name: campaignName }))
    if (!confirmed) return

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
    <section className="card card-danger">
      <h2 className="cs-section-title">{t('settings.dangerTitle')}</h2>

      <p className="cs-placeholder-text">{t('settings.deleteCampaignHint')}</p>

      {error && <p className="cs-placeholder-text cs-text-danger">{error}</p>}

      <button
        className="btn btn-danger"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? t('settings.deletingCampaign') : t('settings.deleteCampaign')}
      </button>
    </section>
  )
}
