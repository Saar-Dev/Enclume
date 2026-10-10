// client/src/components/campaignSettings/CampaignSettingsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import SectionDice from './SectionDice'
import SectionGameRules from './SectionGameRules'
import SectionTokens from './SectionTokens'
import SectionPlayers from './SectionPlayers'
import SectionCharacterSheet from './SectionCharacterSheet'
import SectionSources from './SectionSources'
import SectionDanger from './SectionDanger'

export default function CampaignSettingsPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [activeSection, setActiveSection] = useState('players')
  const [formData, setFormData] = useState(null)

  useEffect(() => { document.title = 'Enclume — Paramètres campagne' }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/campaigns/${campaignId}`)
        const { campaign } = res.data
        // GET /campaigns/:id renvoie désormais settings déjà mergé avec les défauts du schéma
        // serveur (campaignSettingsService.js, source unique) — plus de liste clé→défaut à
        // dupliquer ici, une clé de schéma ajoutée côté serveur apparaît automatiquement.
        const data = {
          name: campaign.name,
          dice_config: campaign.dice_config,
          default_token_glb_url: campaign.default_token_glb_url ?? null,
          default_token_glb_url_drone: campaign.default_token_glb_url_drone ?? null,
          default_token_glb_url_exo: campaign.default_token_glb_url_exo ?? null,
          settings: { ...(campaign.settings || {}) },
        }
        setFormData(data)
        setLoading(false)
      } catch (err) {
        setError(err.response?.status === 403 ? t('settings.accessDenied') : t('settings.errorLoad'))
        setLoading(false)
      }
    }
    load()
  }, [campaignId, t])

  const handleSectionChange = useCallback((patch) => {
    setFormData(prev => ({
      ...prev,
      ...patch,
      settings: {
        ...(prev.settings || {}),
        ...(patch.settings || {}),
      },
    }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus(null)
    try {
      await api.put(`/campaigns/${campaignId}`, formData)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [campaignId, formData])

  if (loading) return (
    <div className="app-shell cs-page-loading-screen">
      <p className="cs-page-loading-text" style={{ position: 'relative', zIndex: 1 }}>{t('common.loading')}</p>
    </div>
  )

  if (error) return (
    <div className="app-shell cs-page-loading-screen">
      <p className="cs-text-danger" style={{ marginBottom: '16px', position: 'relative', zIndex: 1 }}>{error}</p>
      <button className="btn-icon" style={{ position: 'relative', zIndex: 1 }} onClick={() => navigate('/dashboard')}>{t('settings.back')}</button>
    </div>
  )

  const sections = [
    { key: 'players', label: t('settings.sectionPlayers'), enabled: true },
    { key: 'dice', label: t('settings.sectionDice'), enabled: true },
    { key: 'rules', label: t('settings.sectionRules'), enabled: true },
    { key: 'tokens', label: t('settings.sectionTokens'), enabled: true },
    { key: 'sheet', label: t('settings.sectionSheet'), enabled: true },
    { key: 'sources', label: t('settings.sectionSources'), enabled: true },
    { key: 'danger', label: t('settings.dangerTitle'), enabled: true, danger: true },
  ]

  return (
    <div className="app-shell cs-page-container">
      <div className="cs-page-header">
        <button className="btn-icon" onClick={() => navigate('/dashboard')}>{t('settings.back')}</button>
        <h1 className="cs-page-title">{t('settings.pageTitle')}</h1>
        <div className="cs-page-header-right">
          {saveStatus === 'saved' && <span className="cs-save-success">{t('settings.saved')}</span>}
          {saveStatus === 'error' && <span className="cs-save-error">{t('settings.errorSave')}</span>}
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div className="cs-page-body">
        <nav className="cs-page-nav">
          {sections.map(({ key, label, enabled, danger }) => (
            <button
              key={key}
              className={danger ? 'btn-toggle btn-toggle-danger' : 'btn-toggle'}
              data-active={activeSection === key}
              style={{ flex: '0 0 auto', textAlign: 'left', opacity: !enabled ? 0.5 : 1 }}
              onClick={() => enabled && setActiveSection(key)}
              disabled={!enabled}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="cs-page-content">
          {activeSection === 'dice' && formData && (
            <SectionDice initialConfig={formData.dice_config} onChange={handleSectionChange} />
          )}
          {activeSection === 'rules' && formData && (
            <SectionGameRules initialData={formData.settings} onChange={(p) => handleSectionChange({ settings: p })} />
          )}
          {activeSection === 'tokens' && formData && (
            <SectionTokens initialData={formData} campaignId={campaignId} onChange={handleSectionChange} />
          )}
          {activeSection === 'players' && <SectionPlayers campaignId={campaignId} />}
          {activeSection === 'sheet' && formData && (
            <SectionCharacterSheet initialData={formData.settings} onChange={(p) => handleSectionChange({ settings: p })} />
          )}
          {activeSection === 'sources' && (
            <SectionSources campaignId={campaignId} />
          )}
          {activeSection === 'danger' && formData && (
            <SectionDanger campaignId={campaignId} campaignName={formData.name} />
          )}
        </div>
      </div>
    </div>
  )
}
