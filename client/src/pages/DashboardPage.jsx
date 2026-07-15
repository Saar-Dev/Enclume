import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import ChangelogPanel from '../components/ChangelogPanel'

export default function DashboardPage() {
  const { user, clearUser, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState(null)

  const [copiedId, setCopiedId] = useState(null)
  const [uploadingCoverId, setUploadingCoverId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [showCreateChar, setShowCreateChar] = useState(false)
  const [createCharCampaignId, setCreateCharCampaignId] = useState('')
  const coverInputRef = useRef(null)
  const pendingCoverIdRef = useRef(null)
  const createInputRef = useRef(null)
  const joinInputRef = useRef(null)

  useEffect(() => { document.title = 'Enclume — Tableau de bord' }, [])

  useEffect(() => {
    api.get('/campaigns')
      .then(res => setCampaigns(res.data.campaigns))
      .catch(() => setError(t('dashboard.errorLoad')))
      .finally(() => setLoading(false))
  }, [])

  // Vrai si l'utilisateur est GM dans au moins une campagne
  const isGmAnywhere = campaigns.some(c => c.role === 'gm')

  const handleLogout = async () => {
    await api.post('/auth/logout')
    clearUser()
    navigate('/login')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/campaigns', { name: newCampaignName })
      setCampaigns(prev => [...prev, { ...res.data.campaign, role: 'gm' }])
      setNewCampaignName('')
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.errorCreate'))
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/campaigns/join', { invite_code: inviteCode })
      setCampaigns(prev => [...prev, { ...res.data.campaign, role: 'player' }])
      setInviteCode('')
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.errorJoin'))
    }
  }

  const handleCoverClick = (campaignId) => {
    pendingCoverIdRef.current = campaignId
    coverInputRef.current.click()
  }

  const handleCoverChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const campaignId = pendingCoverIdRef.current
    setUploadingCoverId(campaignId)
    try {
      const formData = new FormData()
      formData.append('cover', file)
      const res = await api.post(`/campaigns/${campaignId}/cover`, formData)
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, cover_url: res.data.campaign.cover_url } : c
      ))
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.coverErrorUpload'))
    } finally {
      setUploadingCoverId(null)
      e.target.value = ''
    }
  }

  const handleRenameSubmit = async (campaignId) => {
    const trimmed = editingName.trim()
    if (!trimmed) { setEditingId(null); return }
    try {
      await api.put(`/campaigns/${campaignId}`, { name: trimmed })
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, name: trimmed } : c))
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.renameError'))
    } finally {
      setEditingId(null)
    }
  }

  const handleCopy = async (e, code, id) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  return (
    <div className="dashboard app-shell" style={styles.container}>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleCoverChange}
      />

      {/* HEADER */}
      <div style={{ ...styles.header, position: 'relative', zIndex: 1 }}>
        <div style={styles.logoRow}>
          <img src="/logo.svg" alt="Enclume" style={styles.logoImg} />
          <span style={styles.logo}>Enclume</span>
        </div>

        <div style={styles.headerRight}>
          {/* Lien Packs de textures — visible uniquement si GM dans au moins une campagne */}
          {isGmAnywhere && (
            <button
              className="btn-icon"
              onClick={() => navigate('/workshop')}
            >
              {t('dashboard.workshop')}
            </button>
          )}

          <button className="btn-icon">
            {user?.username}
          </button>

          <button className="btn btn-ghost" onClick={handleLogout}>
            {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* CONTENT */}
          <div style={styles.content}>

            {error && <div style={styles.error}>{error}</div>}

            {loading ? (
              <p style={styles.muted}>{t('common.loading')}</p>
            ) : (
              <div className="campaign-grid">

            {/* COFFRE (Vault) — illustration fixe non modifiable, toujours en première position */}
            <div className="card campaign-card" onClick={() => navigate('/vault')}>
              <div className="vault-cover" />
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>{t('dashboard.vaultCard')}</span>
              </div>
              <div style={styles.cardFooter} onClick={e => e.stopPropagation()}>
                {showCreateChar ? (
                  <>
                    <select
                      style={styles.cardInput}
                      value={createCharCampaignId}
                      onChange={e => setCreateCharCampaignId(e.target.value)}
                    >
                      <option value="">{t('vault.selectCampaignPlaceholder')}</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div style={styles.cardButtons}>
                      <button className="btn btn-ghost" onClick={() => { setShowCreateChar(false); setCreateCharCampaignId('') }}>
                        {t('common.cancel')}
                      </button>
                      <button
                        className="btn"
                        disabled={!createCharCampaignId}
                        onClick={() => navigate(`/campaigns/${createCharCampaignId}/creation`)}
                      >
                        {t('dashboard.createCharacter')}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%' }}
                    onClick={() => setShowCreateChar(true)}
                  >
                    {t('dashboard.createCharacter')}
                  </button>
                )}
              </div>
            </div>

            {/* CAMPAIGNS */}
            {campaigns.map(campaign => (
              <div key={campaign.id} className="card campaign-card">

                {/* COVER */}
                <div
                  className="campaign-cover"
                  onClick={campaign.role === 'gm' ? () => handleCoverClick(campaign.id) : undefined}
                  style={campaign.role === 'gm' ? { cursor: uploadingCoverId === campaign.id ? 'wait' : 'pointer' } : undefined}
                  title={campaign.role === 'gm'
                    ? (uploadingCoverId === campaign.id ? t('dashboard.coverUploading') : t('dashboard.coverUpload'))
                    : undefined}
                >
                  {campaign.cover_url
                    ? <img src={`${import.meta.env.VITE_API_URL}/api/assets/${campaign.cover_url}`} alt={campaign.name} />
                    : <div className="campaign-cover-placeholder" />
                  }
                </div>

                {/* HEADER */}
                <div style={styles.cardHeader}>
                  {campaign.role === 'gm' && editingId === campaign.id ? (
                    <input
                      style={{ ...styles.cardInput, flex: 1, marginRight: 8 }}
                      value={editingName}
                      autoFocus
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSubmit(campaign.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => setEditingId(null)}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={styles.cardTitle}>{campaign.name}</span>
                      {campaign.role === 'gm' && (
                        <button
                          className="btn-icon"
                          style={{ fontSize: 11, padding: '2px 4px' }}
                          onClick={() => { setEditingId(campaign.id); setEditingName(campaign.name) }}
                        >✏</button>
                      )}
                    </div>
                  )}
                  <span className={campaign.role === 'gm' ? 'badge badge-gm' : 'badge badge-player'}>
                    {campaign.role === 'gm' ? t('dashboard.roleGM') : t('dashboard.rolePlayer')}
                  </span>
                </div>

                {/* FOOTER */}
                <div style={styles.cardFooter}>

                  <div className="invite-wrapper">
                    <span style={styles.inviteCode}>
                      #{campaign.invite_code}
                    </span>
                    <button
                      className="copy-btn"
                      onClick={(e) => handleCopy(e, campaign.invite_code, campaign.id)}
                    >
                      {copiedId === campaign.id ? t('dashboard.copied') : "📋"}
                    </button>
                  </div>

                  <div style={styles.cardButtons}>
                    <button
                      className="btn"
                      onClick={() => navigate(`/session/${campaign.id}`)}
                    >
                      {t('dashboard.play')}
                    </button>
                  </div>

                </div>

                {/* SETTINGS GM */}
                {campaign.role === 'gm' && (
                  <div style={{ ...styles.cardActions, display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate(`/campaigns/${campaign.id}/settings`)}
                    >
                      {t('dashboard.settings')}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate(`/campaigns/${campaign.id}/merchants`)}
                    >
                      {t('dashboard.merchants')}
                    </button>
                  </div>
                )}

              </div>
            ))}

            {/* REJOINDRE CARD */}
            <div
              className="card campaign-join"
              onClick={() => joinInputRef.current?.focus()}
            >
              <div className="join-label">{t('dashboard.joinCard')}</div>
              <form onSubmit={handleJoin} style={styles.cardForm} onClick={e => e.stopPropagation()}>
                <input
                  ref={joinInputRef}
                  style={styles.cardInput}
                  placeholder={t('dashboard.codePlaceholder')}
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  required
                />
                <button className="btn" type="submit">{t('dashboard.join')}</button>
              </form>
            </div>

            {/* CREATE CARD */}
            <div
              className="card campaign-create"
              onClick={() => createInputRef.current?.focus()}
            >
              <div className="create-label">{t('dashboard.createCardLabel')}</div>
              <form onSubmit={handleCreate} style={styles.cardForm} onClick={e => e.stopPropagation()}>
                <input
                  ref={createInputRef}
                  style={styles.cardInput}
                  placeholder={t('dashboard.campaignName')}
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  required
                />
                <button className="btn" type="submit">{t('dashboard.create')}</button>
              </form>
            </div>

          </div>
            )}

          </div>

        </div>
        <ChangelogPanel />
      </div>

    </div>
  )
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    height: '56px',
    flexShrink: 0,
    backgroundColor: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border-subtle)',
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  logoImg: {
    width: '28px',
    height: 'auto',
    color: 'var(--text-primary)',
  },

  logo: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },


  content: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 32px',
  },

  error: {
    backgroundColor: 'rgba(224,92,92,0.12)',
    border: '1px solid var(--color-danger)',
    borderRadius: '6px',
    padding: '10px 14px',
    color: 'var(--color-danger)',
    fontSize: '13px',
    marginBottom: '20px',
  },

  muted: {
    color: 'var(--text-muted)',
    fontSize: '14px',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    fontSize: '15px',
    fontWeight: '500',
  },

  cardFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  cardButtons: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },

  cardActions: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '12px',
  },

  inviteCode: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
  },


  cardForm: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  cardInput: {
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box',
  },
}
