// client/src/components/campaignSettings/CampaignSettingsPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import SectionDice from './SectionDice'
import SectionGameRules from './SectionGameRules'
import SectionTokens from './SectionTokens'
import SectionPlayers from './SectionPlayers'
import SectionCharacterSheet from './SectionCharacterSheet'

export default function CampaignSettingsPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [activeSection, setActiveSection] = useState('dice')
  const [initialData, setInitialData] = useState(null)
  const formRef = useRef({})

  useEffect(() => { document.title = 'Enclume — Paramètres campagne' }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/campaigns/${campaignId}`)
        const { campaign } = res.data
        const s = campaign.settings || {}
        const data = {
          dice_config: campaign.dice_config,
          default_token_glb_url: campaign.default_token_glb_url ?? null,
          settings: {
            ambiance: s.ambiance ?? 'INTERMEDIAIRE',
            feminin_bonus: s.feminin_bonus ?? false,
            random_mutations: s.random_mutations ?? true,
            polaris_latent: s.polaris_latent ?? false,
            random_pro_advantages: s.random_pro_advantages ?? true,
            revers: s.revers ?? false,
            skill_prerequisites: s.skill_prerequisites ?? false,
            skill_max_level: s.skill_max_level ?? false,
            skill_natural_prog: s.skill_natural_prog ?? false,
            young_penalty: s.young_penalty ?? false,
            celebrity: s.celebrity ?? false,
            pnj_unlimited_ammo: s.pnj_unlimited_ammo ?? true,
            reload_mode: s.reload_mode ?? 'magazine',
            action_timer_sec: s.action_timer_sec ?? 0,
            shock_auto_stun: s.shock_auto_stun ?? true,
            allow_los_cancel: s.allow_los_cancel ?? false,
          },
        }
        setInitialData(data)
        formRef.current = { ...data }
        setLoading(false)
      } catch (err) {
        setError(err.response?.status === 403 ? t('settings.accessDenied') : t('settings.errorLoad'))
        setLoading(false)
      }
    }
    load()
  }, [campaignId])

  const handleSectionChange = useCallback((patch) => {
    formRef.current = {
      ...formRef.current,
      ...patch,
      settings: {
        ...(formRef.current.settings || {}),
        ...(patch.settings || {}),
      },
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus(null)
    try {
      await api.put(`/campaigns/${campaignId}`, formRef.current)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [campaignId])

  if (loading) return (
    <div style={s.loadingScreen}>
      <p style={s.loadingText}>{t('common.loading')}</p>
    </div>
  )

  if (error) return (
    <div style={s.loadingScreen}>
      <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>
      <button style={s.btnGhost} onClick={() => navigate('/dashboard')}>{t('settings.back')}</button>
    </div>
  )

  const sections = [
    { key: 'dice', label: t('settings.sectionDice'), enabled: true },
    { key: 'rules', label: t('settings.sectionRules'), enabled: true },
    { key: 'tokens', label: t('settings.sectionTokens'), enabled: true },
    { key: 'players', label: t('settings.sectionPlayers'), enabled: false },
    { key: 'sheet', label: t('settings.sectionSheet'), enabled: true },
  ]

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>{t('settings.back')}</button>
        <h1 style={s.pageTitle}>{t('settings.pageTitle')}</h1>
        <div style={s.headerRight}>
          {saveStatus === 'saved' && <span style={s.saveSuccess}>{t('settings.saved')}</span>}
          {saveStatus === 'error' && <span style={s.saveError}>{t('settings.errorSave')}</span>}
          <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div style={s.body}>
        <nav style={s.nav}>
          {sections.map(({ key, label, enabled }) => (
            <button
              key={key}
              style={{
                ...s.navItem,
                ...(activeSection === key ? s.navItemActive : {}),
                ...(!enabled ? s.navItemDisabled : {}),
              }}
              onClick={() => enabled && setActiveSection(key)}
              disabled={!enabled}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={s.content}>
          {activeSection === 'dice' && initialData && (
            <SectionDice initialConfig={initialData.dice_config} onChange={handleSectionChange} />
          )}
          {activeSection === 'rules' && initialData && (
            <SectionGameRules initialData={initialData.settings} onChange={(p) => handleSectionChange({ settings: p })} />
          )}
          {activeSection === 'tokens' && initialData && (
            <SectionTokens initialData={initialData} campaignId={campaignId} onChange={handleSectionChange} />
          )}
          {activeSection === 'players' && <SectionPlayers />}
          {activeSection === 'sheet' && initialData && (
            <SectionCharacterSheet initialData={initialData.settings} onChange={(p) => handleSectionChange({ settings: p })} />
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  loadingScreen: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'var(--text-muted)', fontSize: '14px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', padding: '0 32px', height: '56px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '4px 0', flexShrink: 0 },
  pageTitle: { fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)', flex: 1, margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  saveSuccess: { fontSize: '13px', color: '#4caf77' },
  saveError: { fontSize: '13px', color: 'var(--color-danger)' },
  body: { display: 'flex', flex: 1, maxWidth: '960px', margin: '0 auto', width: '100%', padding: '32px', gap: '32px', boxSizing: 'border-box' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px', width: '160px', flexShrink: 0, paddingTop: '4px' },
  navItem: { background: 'none', border: 'none', textAlign: 'left', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' },
  navItemActive: { backgroundColor: 'rgba(91,141,238,0.12)', color: '#5b8dee', fontWeight: '500' },
  navItemDisabled: { color: 'var(--text-muted)', cursor: 'default', opacity: 0.5 },
  content: { flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' },
  btnPrimary: { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 18px', fontWeight: '500', fontSize: '13px', cursor: 'pointer' },
  btnGhost: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '8px', cursor: 'pointer' },
}